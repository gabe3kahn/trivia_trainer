#!/usr/bin/env node
/**
 * LLM editorial critic — the last gate before a clue pack reaches a review PR.
 *
 * The deterministic linters (question-quality-rules / feedback-quality-rules /
 * validate-wordplay) catch STRUCTURAL faults: exact/stem answer leaks, thin/overlong
 * clues, broken wordplay mechanics. They are blind to the EDITORIAL faults that keep
 * showing up in review — tortured wording, a difficulty that doesn't match the value,
 * too-easy initials, a hidden word that's signposted instead of surprising, a synonym
 * leak the regex misses. Those need judgment, so this shells out to a fresh-context
 * model with a fixed rubric and asks it to critique each clue: pass / revise / drop.
 *
 * It reviews (it does not rewrite the pack): the report is what the drafter agent (or a
 * human reviewer) acts on before opening/merging a PR. Runs wherever the drafter does —
 * the `claude` CLI authenticated via CLAUDE_CODE_OAUTH_TOKEN in CI, or a local install.
 * The deterministic leak findings are passed in as hints so the model doesn't re-derive
 * them. If the CLI is missing or errors, it prints a warning and exits 0 (advisory tool,
 * never a hard blocker) — the deterministic gates remain the hard line.
 *
 *   node tools/acquisition/critique-clues.mjs --pack data/sourcing/packs/drafts/<pack>.json [--pack …] [--model <id>]
 *
 * Exit code is always 0; read the printed summary / the JSON+MD report written to
 * data/acquisition/clue-critique-<pack>.{json,md}.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { auditFeedbackIssues } from './feedback-quality-rules.mjs';

const argv = process.argv.slice(2);
const packPaths = [];
let model = 'claude-sonnet-4-6';
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--pack') packPaths.push(argv[(i += 1)]);
  else if (argv[i] === '--model') model = argv[(i += 1)];
  else if (!argv[i].startsWith('--')) packPaths.push(argv[i]);
}
if (!packPaths.length) {
  console.error('usage: critique-clues.mjs --pack <pack.json> [--pack …] [--model <id>]');
  process.exit(1);
}

const RUBRIC = [
  'You are a STRICT trivia editor reviewing clues for a Jeopardy-style practice app before they go live.',
  'Apply the rubric to each clue and return a verdict. Be conservative: flag only genuine problems, and',
  'prefer "revise" with a concrete rewrite over a vague complaint. Reserve "drop" for irredeemable clues.',
  '',
  'RUBRIC — flag every dimension that applies:',
  '- leak: the answer, ANY alias, a shared word-stem, or an obvious synonym appears in the clue and gives it',
  '  away. (Deterministic linter hits are pre-listed per item as "linter_flags" — corroborate + extend them,',
  "  especially synonyms/paraphrases the regex can't see.)",
  '- wording: the clue is not a clean, single-parse declarative sentence — a solver should grasp it on the',
  '  first read. Flag front-loaded subordinate clauses that bury the subject ("Along with the cross, one of',
  '  two punches classified as…, this strike…"), stacked em-dash asides, or otherwise convoluted phrasing.',
  '- difficulty_fit: the dollar value does not match the clue\'s real difficulty. A marquee/household answer',
  '  reached by a direct hook belongs at $200–$400; $800–$1000 requires an oblique hook OR a genuinely deep',
  '  answer, not a famous one described plainly. Suggest a corrected value when it is off.',
  '- initials: (ONLY if mechanic="initials") the initials are a large hint, so the clue must be pitched at',
  '  least one tier HARDER than a normal clue at the same value. Flag initials clues that are too easy for',
  '  their value (a plainly-described marquee entity).',
  '- hidden_word: (ONLY if mechanic="hidden_word") the carrier word must be an ORDINARY word whose meaning is',
  '  unrelated to the answer, and the clue must NOT also define the answer — the hidden word should be a',
  '  surprise, never signposted by the surrounding clue.',
  '- answer_form: the primary answer should be the shortest natural form a player would actually say',
  '  (e.g. "Rose Bowl", not "Rose Bowl Game"; move the longer form to an alias).',
  '- factual: the clue\'s claim contradicts or is not supported by the provided citation snippet.',
  '',
  'For EACH clue return an object:',
  '{"external_id":"<id>","verdict":"pass"|"revise"|"drop",',
  ' "issues":[{"dimension":"leak|wording|difficulty_fit|initials|hidden_word|answer_form|factual","detail":"<short>"}],',
  ' "suggested_clue":"<full rewritten clue, ONLY when a clue rewrite fixes it; omit otherwise>",',
  ' "suggested_value":<200|400|600|800|1000, ONLY when difficulty_fit is flagged>,',
  ' "notes":"<one line, optional>"}',
  'pass = ship as-is (empty issues). Respond with ONLY a JSON array, no prose, no code fences.',
].join('\n');

const CITATION_CAP = 400;

function itemBlock(q, index) {
  const linter = auditFeedbackIssues(q);
  const cite = (q.citations && q.citations[0] && q.citations[0].snippet) || '';
  const lines = [
    `### Item ${index + 1}`,
    `external_id: ${q.external_id || q.answer}`,
    `category: ${q.category_id}`,
    `subcategory: ${q.subcategory_name || ''}`,
    `mechanic: ${q.mechanic || 'standard'}`,
    `value: ${q.value}`,
    `answer: ${q.answer}`,
    `aliases: ${(q.aliases || []).join(' | ') || '(none)'}`,
  ];
  if (q.wp && Object.keys(q.wp).length) lines.push(`wp: ${JSON.stringify(q.wp)}`);
  lines.push(`clue: ${q.clue}`);
  if (cite) lines.push(`citation: ${String(cite).slice(0, CITATION_CAP)}`);
  lines.push(`linter_flags: ${linter.issues.length ? linter.issues.join(', ') : '(none)'}`);
  return lines.join('\n');
}

function runClaude(prompt, timeoutMs = 360000) {
  return new Promise((resolve, reject) => {
    // shell:true so the npm-global `claude` shim resolves on Windows + POSIX; the prompt
    // is piped via stdin (not argv) so size/quoting are non-issues and there's no
    // shell-injection surface (argv is fixed flags only). Mirrors llm-grader.mjs.
    const child = spawn(`claude -p --output-format json --model ${model}`, { shell: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('claude critic timed out'));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`));
      try {
        const env = JSON.parse(out);
        resolve(typeof env.result === 'string' ? env.result : out);
      } catch {
        resolve(out);
      }
    });
    child.stdin.end(prompt);
  });
}

function extractJsonArray(text) {
  if (!text) return null;
  const fenced = text.replace(/```(?:json)?/gi, '');
  const start = fenced.indexOf('[');
  const end = fenced.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function critiquePack(packPath) {
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
  const questions = pack.questions || pack;
  const prompt = `${RUBRIC}\n\n${questions.map(itemBlock).join('\n\n')}`;

  let verdicts;
  try {
    verdicts = extractJsonArray(await runClaude(prompt));
  } catch (e) {
    console.error(`  ! critic call failed for ${path.basename(packPath)}: ${e.message}`);
    console.error('    (advisory tool — skipping; the deterministic gates still apply)');
    return null;
  }
  if (!verdicts) {
    console.error(`  ! critic returned no parseable JSON for ${path.basename(packPath)} — skipping`);
    return null;
  }

  const byId = new Map(verdicts.map((v) => [String(v.external_id), v]));
  const rows = questions.map((q) => {
    const v = byId.get(String(q.external_id || q.answer)) || { verdict: 'pass', issues: [] };
    return { external_id: q.external_id || q.answer, answer: q.answer, value: q.value, ...v };
  });
  return { packPath, rows };
}

function renderMarkdown(results) {
  const lines = ['# Clue critique', ''];
  for (const { packPath, rows } of results) {
    const flagged = rows.filter((r) => r.verdict !== 'pass');
    lines.push(`## ${path.basename(packPath)} — ${flagged.length}/${rows.length} need work`, '');
    if (!flagged.length) {
      lines.push('_All clues pass._', '');
      continue;
    }
    for (const r of flagged) {
      lines.push(`### [${r.verdict.toUpperCase()}] ${r.external_id} — "${r.answer}" ($${r.value})`);
      for (const iss of r.issues || []) lines.push(`- **${iss.dimension}**: ${iss.detail}`);
      if (r.suggested_value) lines.push(`- suggested value: **$${r.suggested_value}**`);
      if (r.suggested_clue) lines.push(`- suggested clue: ${r.suggested_clue}`);
      if (r.notes) lines.push(`- notes: ${r.notes}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

const results = [];
for (const packPath of packPaths) {
  console.log(`Critiquing ${path.basename(packPath)} with ${model}…`);
  const res = await critiquePack(packPath);
  if (res) results.push(res);
}

if (!results.length) {
  console.log('No critiques produced.');
  process.exit(0);
}

const outDir = 'data/acquisition';
fs.mkdirSync(outDir, { recursive: true });
const stem = results.length === 1 ? path.basename(results[0].packPath).replace(/\.json$/, '') : 'batch';
fs.writeFileSync(path.join(outDir, `clue-critique-${stem}.json`), JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(outDir, `clue-critique-${stem}.md`), renderMarkdown(results));

let totalFlagged = 0;
for (const { packPath, rows } of results) {
  const revise = rows.filter((r) => r.verdict === 'revise');
  const drop = rows.filter((r) => r.verdict === 'drop');
  totalFlagged += revise.length + drop.length;
  console.log(`\n${path.basename(packPath)}: pass=${rows.length - revise.length - drop.length}, revise=${revise.length}, drop=${drop.length}`);
  for (const r of [...drop, ...revise]) {
    console.log(`  [${r.verdict}] ${r.external_id} "${r.answer}" — ${(r.issues || []).map((i) => i.dimension).join(', ') || '?'}`);
  }
}
console.log(
  totalFlagged
    ? `\nCRITIC: ${totalFlagged} clue(s) need revision — address them before opening/merging. Report: ${outDir}/clue-critique-${stem}.md`
    : '\nCRITIC: all clues pass.',
);
