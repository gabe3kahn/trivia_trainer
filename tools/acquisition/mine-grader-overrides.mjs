/**
 * Mine self-grade overrides to improve the grader.
 *
 * We don't store the auto-grade, only the user's final grade + their typed text.
 * So for every recorded attempt we RECOMPUTE what the auto-grader would have said
 * (from typed_response + the question's answer/aliases) and compare it to the
 * grade the user actually recorded. Disagreements are the signal:
 *
 *   - final=correct, auto≠correct  → MISSING ALIAS: the typed form should be
 *     accepted. Candidate alias to ADD to that question.
 *   - final≠correct, auto=correct  → FALSE ACCEPT: the grader credited something
 *     the user rejected. Either a bad alias to REMOVE, a fuzzy false-positive, or
 *     an ambiguous clue/bug to fix.
 *
 * Read-only: writes a report, never mutates the bank. Re-run as more sessions
 * accumulate; candidates are ranked by how often they recur.
 *
 *   node tools/acquisition/mine-grader-overrides.mjs
 *   node tools/acquisition/mine-grader-overrides.mjs --min 2   # only recurring ones
 *
 * NOTE: the normalize + match logic below MIRRORS mobile/src/scoring/answerGrader.ts.
 * Keep the two in sync when the grader changes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const minCount = Number(args.min ?? 1);

await loadDefaultEnv(process.cwd());
const request = createSupabaseRequest(getSupabaseAdminConfig());

const rows = await fetchAllSupabaseRows(
  request,
  '/rest/v1/practice_attempts?select=typed_response,grade,question_id,questions(answer,aliases,mechanic,clue)&typed_response=not.is.null',
);

const missing = new Map(); // key -> {question_id, answer, clue, typed, count}
const falseAccept = new Map();
let compared = 0;
let overrides = 0;

for (const row of rows) {
  const q = row.questions;
  if (!q || !row.typed_response) continue;
  compared += 1;
  const auto = autoGrade(q, row.typed_response);
  const finalCorrect = row.grade === 'correct';
  const autoCorrect = auto.grade === 'correct';
  if (finalCorrect === autoCorrect) continue; // grader and user agree
  overrides += 1;

  const key = `${row.question_id}::${normalizeAnswer(row.typed_response)}`;
  const bucket = finalCorrect ? missing : falseAccept;
  const entry = bucket.get(key) ?? {
    question_id: row.question_id,
    answer: q.answer,
    clue: q.clue,
    typed: row.typed_response.trim(),
    via: auto.via,
    count: 0,
  };
  entry.count += 1;
  bucket.set(key, entry);
}

const missingList = [...missing.values()].filter((e) => e.count >= minCount).sort((a, b) => b.count - a.count);
const falseList = [...falseAccept.values()].filter((e) => e.count >= minCount).sort((a, b) => b.count - a.count);

const summary = {
  generated_at: new Date().toISOString(),
  attempts_with_typed_response: compared,
  reconstructed_overrides: overrides,
  missing_alias_candidates: missingList,
  false_accept_candidates: falseList,
};

const outDir = path.join(process.cwd(), 'data', 'acquisition');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'grader-override-mining.json'), JSON.stringify(summary, null, 2));
await fs.writeFile(path.join(outDir, 'grader-override-mining.md'), renderMarkdown(summary));

console.log(`Compared ${compared} attempts; ${overrides} reconstructed overrides.`);
console.log(`MISSING ALIAS candidates (add): ${missingList.length}`);
for (const e of missingList.slice(0, 15)) console.log(`  +${e.count}  "${e.typed}"  ->  ${e.answer}`);
console.log(`FALSE ACCEPT candidates (remove/fix): ${falseList.length}`);
for (const e of falseList.slice(0, 15)) console.log(`  +${e.count}  "${e.typed}"  graded against ${e.answer}  (via ${e.via})`);
console.log(`\nWrote data/acquisition/grader-override-mining.{json,md}`);

/* ----------------------- grade reconstruction ----------------------- */
// Mirror of mobile/src/scoring/answerGrader.ts (keep in sync).

function autoGrade(question, response) {
  const submitted = normalizeAnswer(response);
  const accepted = [question.answer, ...(question.aliases ?? [])].map(normalizeAnswer).filter(Boolean);
  if (!submitted) return { grade: 'unknown', via: null };
  if (accepted.includes(submitted)) return { grade: 'correct', via: 'exact' };
  const closeTo = accepted.find((a) => isClose(submitted, a));
  if (closeTo) return { grade: 'correct', via: 'fuzzy' };
  return { grade: 'missed', via: null };
}

function normalizeAnswer(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(what|who|where|when|why|how)\s+(is|are|was|were)\s+/i, '')
    .replace(/^(what|who|where|when|why|how)\s+/i, '')
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isClose(submitted, answer) {
  if (submitted.length < 4 || answer.length < 4) return false;
  const subTokens = submitted.split(' ').filter(Boolean);
  const ansTokens = answer.split(' ').filter(Boolean);
  if (containsTokenSequence(subTokens, ansTokens) || containsTokenSequence(ansTokens, subTokens)) return true;
  const distance = levenshtein(submitted, answer);
  const maxLength = Math.max(submitted.length, answer.length);
  if (maxLength < 8) {
    if (submitted.length === answer.length) return false;
    if (submitted[0] !== answer[0]) return false;
  }
  const tolerance = maxLength >= 10 ? 2 : 1;
  return distance <= tolerance;
}

function containsTokenSequence(haystack, needle) {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return true;
  }
  return false;
}

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = cur[j];
  }
  return prev[b.length];
}

/* ------------------------------ render ------------------------------ */

function renderMarkdown(s) {
  const tbl = (list, cols) => [
    '| ' + cols.join(' | ') + ' |',
    '| ' + cols.map(() => '---').join(' | ') + ' |',
    ...list.map((e) => '| ' + [e.count, cell(e.typed), cell(e.answer), cell(e.clue)].join(' | ') + ' |'),
  ].join('\n');
  return [
    '# Grader Override Mining',
    '',
    `Generated: ${s.generated_at}`,
    `Attempts with a typed response: ${s.attempts_with_typed_response} · reconstructed overrides: ${s.reconstructed_overrides}`,
    '',
    'Reconstructed by recomputing the auto-grade from the typed text and comparing to the recorded grade. Review before acting — never auto-applied.',
    '',
    '## Missing-alias candidates (user said Correct, grader said Missed → consider ADDING the typed form as an alias)',
    '',
    s.missing_alias_candidates.length ? tbl(s.missing_alias_candidates, ['#', 'Typed', 'Answer', 'Clue']) : '_none_',
    '',
    '## False-accept candidates (user said Missed, grader said Correct → REMOVE a bad alias / tighten fuzzy / fix the clue)',
    '',
    s.false_accept_candidates.length ? tbl(s.false_accept_candidates, ['#', 'Typed', 'Answer', 'Clue']) : '_none_',
    '',
  ].join('\n');
}

function cell(v) {
  return String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const val = argv[i + 1]?.startsWith('--') ? true : argv[i + 1] ?? true;
    parsed[key] = val;
    if (val !== true) i += 1;
  }
  return parsed;
}
