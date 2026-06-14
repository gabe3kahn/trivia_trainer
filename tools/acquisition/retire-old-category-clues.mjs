/**
 * Build-then-swap helper: retire the old clues in a category once a rebuilt,
 * source-grounded set has been imported. "Retire" = set is_active=false (NOT a
 * delete), so it's fully reversible and the rows remain for reference.
 *
 * Deactivates active questions in --category whose source is NOT --keep-source
 * (the new sourced set). Run with --dry-run first to see the before picture.
 *
 * Usage:
 *   node tools/acquisition/retire-old-category-clues.mjs --category geography --dry-run
 *   node tools/acquisition/retire-old-category-clues.mjs --category geography --keep-source original_sourced
 */

import { createSupabaseRequest, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const category = args.category;
const keepSource = args['keep-source'] ?? 'original_sourced';
const dryRun = Boolean(args['dry-run'] ?? args.dryRun);

if (!category) throw new Error('Usage: --category <id> [--keep-source original_sourced] [--dry-run]');

await loadDefaultEnv(process.cwd());
const request = createSupabaseRequest(getSupabaseAdminConfig());

const active = await request(
  `/rest/v1/questions?select=source&category_id=eq.${encodeURIComponent(category)}&is_active=eq.true`,
);
const bySource = active.reduce((acc, row) => ((acc[row.source] = (acc[row.source] ?? 0) + 1), acc), {});

console.log(`Active "${category}" clues by source (before):`);
for (const [src, n] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${src.padEnd(24)} ${n}${src === keepSource ? '   (keep)' : '   -> retire'}`);
}
const toRetire = active.filter((r) => r.source !== keepSource).length;
const keep = active.length - toRetire;

if (dryRun) {
  console.log(`\nDry run: would retire ${toRetire}, keep ${keep} (${keepSource}).`);
  process.exit(0);
}

if (toRetire === 0) {
  console.log('\nNothing to retire.');
  process.exit(0);
}

await request(
  `/rest/v1/questions?category_id=eq.${encodeURIComponent(category)}&is_active=eq.true&source=neq.${encodeURIComponent(keepSource)}`,
  { method: 'PATCH', body: JSON.stringify({ is_active: false }), headers: { Prefer: 'return=minimal' } },
);

const after = await request(
  `/rest/v1/questions?select=source&category_id=eq.${encodeURIComponent(category)}&is_active=eq.true`,
);
console.log(`\nRetired ${toRetire} old clue(s). Active "${category}" now: ${after.length} (all ${keepSource}).`);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1]?.startsWith('--') ? true : argv[index + 1] ?? true;
    parsed[key] = value;
    if (value !== true) index += 1;
  }
  return parsed;
}
