/**
 * Retire (deactivate) every active clue that isn't part of our source-grounded,
 * cited bank. Keeps source IN (original_sourced, deck_import); deactivates the
 * rest (opentdb and the legacy original_*_pack / manual_seed imports).
 *
 * Reversible: sets is_active=false (does NOT delete). Re-activate later with the
 * inverse PATCH if needed.
 *
 *   node tools/acquisition/retire-unverified.mjs            # dry run (default)
 *   node tools/acquisition/retire-unverified.mjs --apply    # actually deactivate
 */

import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';

const KEEP = ['original_sourced', 'deck_import'];
const apply = process.argv.includes('--apply');

await loadDefaultEnv(process.cwd());
const request = createSupabaseRequest(getSupabaseAdminConfig());

const active = await fetchAllSupabaseRows(request, '/rest/v1/questions?is_active=eq.true&select=id,category_id,source');
const doomed = active.filter((q) => !KEEP.includes(q.source));
const keep = active.filter((q) => KEEP.includes(q.source));

const bySource = {};
const byCat = {};
for (const q of doomed) {
  bySource[q.source || '(none)'] = (bySource[q.source || '(none)'] || 0) + 1;
}
for (const q of keep) {
  byCat[q.category_id || '(none)'] = (byCat[q.category_id || '(none)'] || 0) + 1;
}

console.log(`Active now: ${active.length}`);
console.log(`Would deactivate (unverified/legacy): ${doomed.length}`);
console.log('  by source:', JSON.stringify(bySource));
console.log(`Would keep (source-grounded): ${keep.length}`);
console.log('  remaining active by category:', JSON.stringify(byCat));

if (!apply) {
  console.log('\nDRY RUN. Re-run with --apply to deactivate the legacy clues.');
  process.exit(0);
}

// Bulk PATCH: deactivate everything whose source isn't in the keep-set.
const list = KEEP.map(encodeURIComponent).join(',');
const path = `/rest/v1/questions?is_active=eq.true&source=not.in.(${list})`;
const res = await request(path, {
  method: 'PATCH',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({ is_active: false }),
});
void res;

const after = await fetchAllSupabaseRows(request, '/rest/v1/questions?is_active=eq.true&select=id');
console.log(`\nApplied. Active clues now: ${after.length} (was ${active.length}).`);
