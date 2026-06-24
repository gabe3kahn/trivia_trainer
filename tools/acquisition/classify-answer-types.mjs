/**
 * One-time backfill for questions.answer_type (migration 023).
 *
 *   'name'  → the answer is a PERSON whose bare surname should count (Jackson Pollock → Pollock)
 *   'other' → everything else (titles, places, works, terms) — the safe default
 *
 * Migration 023 defaults every row to 'other', so this only needs to flip the people to
 * 'name'. It classifies active answers in batches via the `claude` CLI (same auth as the
 * drafter) and PATCHes the 'name' ones. Idempotent — safe to re-run; only writes rows
 * whose type changes. Run AFTER applying migration 023.
 *
 *   node tools/acquisition/classify-answer-types.mjs            # apply
 *   node tools/acquisition/classify-answer-types.mjs --dry-run  # classify + print only
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const BATCH = 40;
const MODEL = 'claude-haiku-4-5-20251001';

const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
const g = (k) => env.match(new RegExp(`${k}=(.*)`))?.[1]?.trim().replace(/^["']|["']$/g, '');
const URL = g('SUPABASE_URL') || g('EXPO_PUBLIC_SUPABASE_URL');
const KEY = g('SUPABASE_SERVICE_ROLE_KEY') || g('SERVICE_ROLE_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const rows = await fetchAllActive();
console.log(`Classifying ${rows.length} active answers in ${Math.ceil(rows.length / BATCH)} batch(es)…`);

const names = []; // ids classified 'name'
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const verdicts = await classify(chunk).catch((e) => {
    console.warn(`  batch ${i / BATCH + 1} failed (${e.message}) — left as 'other'`);
    return {};
  });
  for (const r of chunk) if (verdicts[r.id] === 'name') names.push(r);
  process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
}
console.log(`\n${names.length} classified 'name'.`);
if (names.length) console.log('  e.g.', names.slice(0, 12).map((r) => r.answer).join(', '));

if (DRY) {
  console.log('\n--dry-run: no writes.');
} else {
  let n = 0;
  for (const r of names) {
    const res = await fetch(`${URL}/rest/v1/questions?id=eq.${r.id}&answer_type=neq.name`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ answer_type: 'name' }),
    });
    if (res.ok) n += 1;
    else console.warn('  PATCH failed for', r.answer, res.status);
  }
  console.log(`Wrote answer_type='name' to ${n} row(s). The rest stay 'other'.`);
}

async function fetchAllActive() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL}/rest/v1/questions?select=id,answer,category_id&is_active=eq.true`, {
      headers: { ...H, Range: `${from}-${from + 999}` },
    });
    const d = await r.json();
    out.push(...d);
    if (d.length < 1000) break;
  }
  return out;
}

function classify(chunk) {
  const list = chunk.map((r) => `${r.id}\t${r.answer}\t(${r.category_id})`).join('\n');
  const prompt = [
    'Classify each trivia ANSWER as "name" or "other".',
    '"name" = a specific PERSON whose bare SURNAME alone would be an acceptable answer',
    '  (e.g. "Jackson Pollock", "William Howard Taft", "F. Scott Fitzgerald", "Marie Curie").',
    '"other" = everything else: single-name figures (Plato, Beyoncé, Mozart), mythological/',
    '  divine figures, places, works/titles, bands, terms, concepts, dates, foreign phrases.',
    'When unsure, answer "other".',
    '',
    'Respond with ONLY a JSON object mapping id -> "name"|"other", no prose:',
    '{"<id>":"name", "<id>":"other", ...}',
    '',
    'ID\tANSWER\t(category):',
    list,
  ].join('\n');
  return runClaude(prompt).then((txt) => {
    const s = txt.indexOf('{');
    const e = txt.lastIndexOf('}');
    return s === -1 || e <= s ? {} : JSON.parse(txt.slice(s, e + 1));
  });
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(`claude -p --output-format json --model ${MODEL}`, { shell: true });
    let out = '';
    let err = '';
    const t = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('timeout'));
    }, 120000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 200)}`));
      try {
        const env2 = JSON.parse(out);
        resolve(typeof env2.result === 'string' ? env2.result : out);
      } catch {
        resolve(out);
      }
    });
    child.stdin.end(prompt);
  });
}
