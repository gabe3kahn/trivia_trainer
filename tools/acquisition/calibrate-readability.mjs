#!/usr/bin/env node
/**
 * Offline calibration for readability-rules.mjs. Scores three corpora and reports the
 * distributions + threshold trade-offs, so we can pick a floor that flags genuinely tortured
 * clues WITHOUT tripping on well-written ones:
 *   1. J! Archive  — real aired clues (the paragon; a flag here is a FALSE POSITIVE)
 *   2. our bank    — active questions (what the floor would fire on in production)
 *   3. tortured    — the clues human review flagged as tortured in #116 (must score LOW)
 * Writes nothing to the DB. Report → data/acquisition/readability-calibration.md.
 *
 *   node tools/acquisition/calibrate-readability.mjs [--games 9202,9171,...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreReadability, WEIGHTS } from './readability-rules.mjs';
import { collectClues, DEFAULT_GAME_IDS } from './jarchive-source.mjs';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
await loadDefaultEnv(rootDir);
const argv = process.argv.slice(2);
const games = argv.includes('--games') ? argv[argv.indexOf('--games') + 1].split(',') : DEFAULT_GAME_IDS;
const THRESHOLDS = [75, 70, 65, 60, 55, 50, 45, 40];

// Reviewer-flagged tortured clues from the #116 review (Gabe's "Tortured" / "tortured" comments).
const TORTURED = [
  { answer: 'Polonium', clue: 'Named for the homeland of the woman who co-discovered it in 1898 by extracting it from uranium ore on the basis of its unusual emission intensity alone — with no conventional chemical test — this metallic element has atomic number 84.' },
  { answer: 'Entropy', clue: 'A thermodynamic state variable measuring the probabilistic distribution of accessible microscopic configurations of a system, this quantity — which can never decrease in an isolated system — underpins the second law of thermodynamics.' },
  { answer: 'Absolute zero', clue: "At exactly −273.15°C or −459.67°F, this theoretical temperature minimum corresponds to 0 K on the Kelvin scale and represents the lowest thermodynamic state a system's internal energy can reach." },
];

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const mean = (arr) => (arr.reduce((a, b) => a + b, 0) / arr.length);
const below = (scores, t) => scores.filter((s) => s < t).length;

function summarize(label, scored) {
  const scores = scored.map((r) => r.score);
  const lines = [];
  lines.push(`### ${label} — ${scores.length} clues`);
  lines.push(`min ${Math.min(...scores)} · p5 ${pct(scores, 5)} · p10 ${pct(scores, 10)} · p25 ${pct(scores, 25)} · median ${pct(scores, 50)} · mean ${mean(scores).toFixed(1)}`);
  lines.push('flagged at threshold: ' + THRESHOLDS.map((t) => `<${t}: ${below(scores, t)} (${(100 * below(scores, t) / scores.length).toFixed(1)}%)`).join(' · '));
  // which penalties drive the low scorers (< 70)
  const reasons = {};
  for (const r of scored) if (r.score < 70) for (const p of r.penalties) reasons[p.reason] = (reasons[p.reason] || 0) + 1;
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) lines.push('penalties on <70 scorers: ' + top.map(([r, n]) => `${r}×${n}`).join(', '));
  return { lines, scores };
}

console.log(`Calibrating readability. J!Archive games: ${games.join(',')}`);

// 1. J! Archive
const { clues: jaClues } = await collectClues(games);
const jaScored = jaClues.map((c) => ({ ...scoreReadability(c.clue), clue: c.clue, answer: c.answer }));

// 2. our active bank
const request = createSupabaseRequest(getSupabaseAdminConfig());
const bank = await fetchAllSupabaseRows(request, '/rest/v1/questions?select=answer,clue&is_active=eq.true');
const bankScored = bank.map((c) => ({ ...scoreReadability(c.clue), clue: c.clue, answer: c.answer }));

// 3. tortured control
const tortScored = TORTURED.map((c) => ({ ...scoreReadability(c.clue), clue: c.clue, answer: c.answer }));

const out = ['# Readability calibration', '', '```', `weights: ${JSON.stringify(WEIGHTS)}`, '```', ''];
for (const [label, scored] of [['J! Archive (paragon — flags = false positives)', jaScored], ['Our active bank', bankScored]]) {
  const { lines } = summarize(label, scored);
  out.push(...lines, '');
}
out.push('### Reviewer-flagged tortured clues (must score LOW)');
for (const r of tortScored) out.push(`- **${r.answer}**: score ${r.score} — ${r.penalties.map((p) => `${p.reason}(${p.points})`).join(', ')}`);
out.push('');

// worst 12 real J!Archive clues (candidate false positives to eyeball)
out.push('### Lowest-scoring J! Archive clues (would-be false positives)');
for (const r of [...jaScored].sort((a, b) => a.score - b.score).slice(0, 12)) {
  out.push(`- **${r.score}** [${r.penalties.map((p) => p.reason).join(', ')}] "${r.clue.slice(0, 140)}${r.clue.length > 140 ? '…' : ''}"`);
}
out.push('');
out.push('### Lowest-scoring bank clues');
for (const r of [...bankScored].sort((a, b) => a.score - b.score).slice(0, 12)) {
  out.push(`- **${r.score}** [${r.penalties.map((p) => p.reason).join(', ')}] "${r.clue.slice(0, 120)}…" → ${r.answer}`);
}

const outPath = 'data/acquisition/readability-calibration.md';
fs.mkdirSync('data/acquisition', { recursive: true });
fs.writeFileSync(outPath, out.join('\n') + '\n');
console.log(out.join('\n'));
console.log(`\nReport → ${outPath}`);
