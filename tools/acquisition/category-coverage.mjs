// What's already in the live bank, per category — so the drafter starts each run
// coverage-aware: pick genuinely under-covered categories/subcategories, and NEVER
// re-draft an answer that already exists (the import gate only dedups within a single
// pack; cross-run dups against the live bank are the author's responsibility).
//
//   node tools/acquisition/category-coverage.mjs                 # summary, thinnest category first
//   node tools/acquisition/category-coverage.mjs --category <id> # full answer list for one category
//
// Reads active questions via the service-role key (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY,
// from .env.local locally or repo secrets in CI). Read-only.

import {
  loadDefaultEnv,
  getSupabaseAdminConfig,
  createSupabaseRequest,
  fetchAllSupabaseRows,
} from './acquisition-utils.mjs';

const args = process.argv.slice(2);
const ci = args.indexOf('--category');
const only = ci >= 0 ? args[ci + 1] : args.find((a) => !a.startsWith('--')) ?? null;

await loadDefaultEnv();
const request = createSupabaseRequest(getSupabaseAdminConfig());

const [cats, subs] = await Promise.all([
  fetchAllSupabaseRows(request, '/rest/v1/categories?select=id,name,sort_order&order=sort_order'),
  fetchAllSupabaseRows(request, '/rest/v1/subcategories?select=id,name,category_id'),
]);
const catName = new Map(cats.map((c) => [c.id, c.name]));
const subName = new Map(subs.map((s) => [s.id, s.name]));

const filter = only ? `&category_id=eq.${only}` : '';
const rows = await fetchAllSupabaseRows(
  request,
  `/rest/v1/questions?select=category_id,subcategory_id,answer,value,difficulty_rank&is_active=eq.true${filter}`,
);

const valueMix = (list) => {
  const m = {};
  for (const r of list) m[r.value ?? '?'] = (m[r.value ?? '?'] || 0) + 1;
  return (
    Object.keys(m)
      .sort((a, b) => Number(a) - Number(b))
      .map((v) => `$${v}×${m[v]}`)
      .join('  ') || '—'
  );
};

if (!only) {
  const byCat = new Map();
  for (const r of rows) (byCat.get(r.category_id) ?? byCat.set(r.category_id, []).get(r.category_id)).push(r);
  const ranked = cats
    .map((c) => ({ id: c.id, name: c.name, list: byCat.get(c.id) ?? [] }))
    .sort((a, b) => a.list.length - b.list.length);

  console.log('Active question coverage by category (thinnest first):\n');
  for (const c of ranked) {
    const subCounts = {};
    for (const r of c.list) {
      const s = subName.get(r.subcategory_id) ?? '(unmapped)';
      subCounts[s] = (subCounts[s] || 0) + 1;
    }
    const subStr =
      Object.entries(subCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => `${s} ${n}`)
        .join(', ') || '—';
    console.log(`${String(c.list.length).padStart(4)}  ${c.id}  (${c.name})`);
    console.log(`        values:  ${valueMix(c.list)}`);
    console.log(`        subcats: ${subStr}`);
  }
  console.log(
    '\nNext: for each category you pick, dump its existing answers so you do NOT repeat any:\n  node tools/acquisition/category-coverage.mjs --category <category_id>',
  );
} else {
  console.log(`Category: ${only} (${catName.get(only) ?? '?'}) — ${rows.length} active questions`);
  console.log(`values: ${valueMix(rows)}\n`);
  const bySub = {};
  for (const r of rows) (bySub[subName.get(r.subcategory_id) ?? '(unmapped)'] ??= []).push(r);
  console.log('EXISTING ACTIVE ANSWERS — do NOT draft any of these again:');
  for (const s of Object.keys(bySub).sort()) {
    console.log(`\n  [${s}]  (${bySub[s].length})`);
    for (const r of bySub[s].sort((a, b) => (a.value || 0) - (b.value || 0))) {
      console.log(`    $${r.value} r${r.difficulty_rank}  ${r.answer}`);
    }
  }
  console.log('\nGaps = subcategories/topics thin or missing above. Fetch FRESH docs for those, ~1 distinct source per clue.');
}
