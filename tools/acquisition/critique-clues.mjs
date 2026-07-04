#!/usr/bin/env node
/**
 * LLM editorial critic — the last gate before a clue pack reaches a review PR.
 *
 * The deterministic linters (question-quality-rules / feedback-quality-rules /
 * validate-wordplay) catch STRUCTURAL faults: exact/stem answer leaks, thin/overlong
 * clues, broken wordplay mechanics. They are blind to the EDITORIAL faults that keep
 * showing up in review — tortured wording, a difficulty that doesn't match the value,
 * too-easy initials, a hidden word that's signposted, a wrong category, a fact re-drafted
 * from a retired clue. Those need judgment, so this shells out to a fresh-context model
 * with a fixed rubric and asks it to critique each clue: pass / revise / drop.
 *
 * To ground that judgment it gives the model, per clue: the FULL source extract the
 * drafter authored from (data/sourcing/docs/<category>/*.json, matched by URL — same
 * text the author saw, not a truncated snippet), the deterministic linter hits, and —
 * per pack — the list of answers already used in that category (active AND retired, from
 * Supabase) so it can flag a wasteful re-draft. It REVIEWS (it does not rewrite the pack):
 * the report is what the drafter agent (or a human) acts on before a PR.
 *
 * Runs wherever the drafter does — the `claude` CLI (CLAUDE_CODE_OAUTH_TOKEN in CI or a
 * local install) and the SUPABASE_* env for the duplicate check. Everything degrades
 * gracefully: no CLI → warn + skip; no source doc → no factual grounding for that clue;
 * no Supabase → the duplicate dimension is disabled. The deterministic gates remain the
 * hard line; this is advisory and never hard-fails.
 *
 *   node tools/acquisition/critique-clues.mjs --pack data/sourcing/packs/drafts/<pack>.json [--pack …] [--model <id>]
 *
 * Exit code is always 0; read the printed summary / the report in data/acquisition/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { auditFeedbackIssues } from './feedback-quality-rules.mjs';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

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
  'You are a STRICT but FAIR trivia editor reviewing clues for a Jeopardy-style app before they go live.',
  'Return a verdict per clue. Only flag GENUINE problems — a clean clue must PASS. Prefer "revise" with a',
  'concrete fix; reserve "drop" for irredeemable clues or true duplicates.',
  '',
  'GROUNDING — non-negotiable: for every leak / wording / category claim, QUOTE the exact offending',
  'substring from the CLUE as given. If you cannot quote it verbatim from the clue text, do NOT make the',
  'claim. Never reference a word that is not actually in the clue.',
  '',
  'DIMENSIONS — flag every one that genuinely applies:',
  '- leak: the ANSWER, an ALIAS, or a word sharing the answer\'s STEM/ROOT appears in the clue (e.g. a',
  '  "millipede" clue that says "thousand feet"; a clue containing the answer\'s Latin root). A mere SYNONYM',
  '  or paraphrase is NOT a leak — do not flag it as one. A good clue often describes what the answer MEANS,',
  '  and in wordplay a related/soundalike word is often essential to the mechanic. Quote the leaking substring.',
  '- category: the answer\'s subject does not match its category/subcategory (a PERSON → their field; a FILM →',
  '  Film; a PLACE → Geography; a definition/word → words_language). Name the category it should be in.',
  '- difficulty_fit: the dollar value does not match the clue\'s real difficulty, in EITHER direction. Ladder:',
  '  $200 = a household name/fact stated plainly · $400 = one solid identifying fact · $600 = needs triangulation',
  '  or a moderately obscure fact · $800–$1000 = a single oblique/counterintuitive hook OR a genuinely deep or',
  '  lesser-known answer. Calibrate to a KNOWLEDGEABLE TRIVIA PLAYER, not to your own knowledge — do NOT assume a',
  '  specialist (a landscape architect, a mid-tier composer, a scientific term) is "common knowledge." Be',
  '  CONSERVATIVE about downgrading: only lower a value when the answer is genuinely a household name reached by a',
  '  direct hook. Also catch UNDER-priced clues (a plainly-stated fact sitting at $600+). Give suggested_value.',
  '- wording: the clue is not a clean, single-parse declarative sentence. Flag front-loaded subordinate clauses',
  '  that bury the subject, stacked em-dash asides, convoluted phrasing, redundant filler (e.g. "in particle',
  '  physics"), or an odd/wrong word. Quote the offending phrase.',
  '- factual: the clue\'s claim CONTRADICTS the provided SOURCE excerpt. Flag ONLY a clear contradiction — never',
  '  flag merely because a detail is absent from the excerpt (it may be partial).',
  '- duplicate: the answer, or the same underlying FACT, already appears in the EXISTING ANSWERS list given for',
  '  this category below — INCLUDING retired ones. Re-drafting a previously-clued answer is wasted work. Name the',
  '  match. (If no list is provided, skip this dimension.)',
  '- wordplay (ONLY for language_wordplay clues): judge the MECHANIC and, above all, RETRIEVABILITY — could a',
  '  solver actually reach the answer? A Before & After\'s two halves must each be a real standalone phrase AND be',
  '  non-trivially spliced (not two unrelated things bolted together; not so independent that a half is just its',
  '  own plain clue). A hidden-word carrier must be an ordinary word unrelated to the answer, and the clue must',
  '  not define the answer.',
  '',
  'SUGGESTED REWRITES (suggested_clue): follow the craft rules the authors do — lead with the subject, keep it',
  'tight, introduce NO new term close to the answer. For a WORDPLAY clue, a rewrite MUST preserve the wp',
  'constraint (same scramble letters / same splice / same hidden carrier / same soundalike); if you cannot',
  'preserve it, flag the issue but OMIT suggested_clue — do not propose a rewrite that breaks the mechanic.',
  '',
  'Return one object per clue:',
  '{"external_id":"<id>","verdict":"pass"|"revise"|"drop",',
  ' "issues":[{"dimension":"leak|category|difficulty_fit|wording|factual|duplicate|wordplay","detail":"<quote the substring>"}],',
  ' "suggested_clue":"<full rewrite, only when it fixes the issue AND preserves any mechanic; omit otherwise>",',
  ' "suggested_value":<200|400|600|800|1000, only when difficulty_fit>, "notes":"<one line, optional>"}',
  'pass = ship as-is (empty issues). Respond with ONLY a JSON array, no prose, no code fences.',
].join('\n');

const SOURCE_CAP = 4000;

// Build a URL -> full extract map from the drafter's source docs for a category, so the
// critic fact-checks against the SAME text the author wrote from (not a truncated snippet).
function loadDocs(categoryId) {
  const dir = path.join(rootDir, 'data', 'sourcing', 'docs', categoryId);
  const map = new Map();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return map; }
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const text = d.extract || d.summary;
      if (d.url && text) map.set(normUrl(d.url), text);
    } catch { /* skip unreadable doc */ }
  }
  return map;
}

function normUrl(u) { return String(u).trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase(); }

function sourceFor(q, docMap) {
  const urls = [q.source_url, ...((q.citations || []).map((c) => c.url))].filter(Boolean);
  for (const u of urls) { const hit = docMap.get(normUrl(u)); if (hit) return hit; }
  // fall back to the (truncated) citation snippet if no full doc matched
  return (q.citations && q.citations[0] && q.citations[0].snippet) || '';
}

async function loadExistingAnswers(categoryId) {
  try {
    const request = createSupabaseRequest(getSupabaseAdminConfig());
    const rows = await fetchAllSupabaseRows(
      request,
      `/rest/v1/questions?select=answer,is_active&category_id=eq.${encodeURIComponent(categoryId)}`,
    );
    const seen = new Set();
    for (const r of rows) { const a = String(r.answer || '').trim(); if (a) seen.add(a); }
    return [...seen];
  } catch {
    return null; // no creds / offline → duplicate dimension disabled
  }
}

function itemBlock(q, index, docMap) {
  const linter = auditFeedbackIssues(q);
  const src = String(sourceFor(q, docMap)).slice(0, SOURCE_CAP);
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
  if (src) lines.push(`source_excerpt: ${src}`);
  lines.push(`linter_flags: ${linter.issues.length ? linter.issues.join(', ') : '(none)'}`);
  return lines.join('\n');
}

function runClaude(prompt, timeoutMs = 360000) {
  return new Promise((resolve, reject) => {
    // shell:true so the npm-global `claude` shim resolves on Windows + POSIX; the prompt is
    // piped via stdin (not argv) so size/quoting are non-issues. Mirrors llm-grader.mjs.
    const child = spawn(`claude -p --output-format json --model ${model}`, { shell: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('claude critic timed out'));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
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
  try { return JSON.parse(fenced.slice(start, end + 1)); } catch { return null; }
}

async function critiquePack(packPath) {
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
  const questions = pack.questions || pack;
  const categoryId = pack.category_id || (questions[0] && questions[0].category_id) || '';
  const docMap = loadDocs(categoryId);
  const existing = await loadExistingAnswers(categoryId);

  const preamble = [RUBRIC];
  if (existing && existing.length) {
    preamble.push('', `EXISTING ANSWERS already used in category "${categoryId}" (active AND retired — a match means a wasteful re-draft):`, existing.join('; '));
  }
  const prompt = `${preamble.join('\n')}\n\n${questions.map((q, i) => itemBlock(q, i, docMap)).join('\n\n')}`;

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
  return { packPath, rows, docs: docMap.size, existing: existing ? existing.length : null };
}

function renderMarkdown(results) {
  const lines = ['# Clue critique', ''];
  for (const { packPath, rows } of results) {
    const flagged = rows.filter((r) => r.verdict !== 'pass');
    lines.push(`## ${path.basename(packPath)} — ${flagged.length}/${rows.length} need work`, '');
    if (!flagged.length) { lines.push('_All clues pass._', ''); continue; }
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

await loadDefaultEnv(rootDir); // for the Supabase duplicate check (no-op if creds absent)

const results = [];
for (const packPath of packPaths) {
  console.log(`Critiquing ${path.basename(packPath)} with ${model}…`);
  const res = await critiquePack(packPath);
  if (res) {
    console.log(`  (source docs matched for ${res.docs} topic(s); ${res.existing == null ? 'duplicate check OFF (no Supabase)' : res.existing + ' existing answers in category'})`);
    results.push(res);
  }
}

if (!results.length) { console.log('No critiques produced.'); process.exit(0); }

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
