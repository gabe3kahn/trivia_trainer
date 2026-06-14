/**
 * Uniqueness verifier for clever combinatorial clues.
 *
 * Given a set of constraints over the country fact store, returns the countries
 * that satisfy ALL of them. A clue is safe to ship only if the constraints
 * resolve to EXACTLY ONE country (the intended answer) — otherwise it's
 * ambiguous and must be tightened.
 *
 * Constraints (AND-ed):
 *   --landlocked true|false
 *   --continent <substr>           (matches any of the country's continents)
 *   --borders <name>               (repeatable; country must border each — substring, case-insensitive)
 *   --not-borders <name>           (repeatable)
 *   --capital <substr>
 *   --border-count <n> | >=n | <=n
 *   --min-area <km2> | --max-area <km2>
 *   --min-pop <n> | --max-pop <n>
 *   --superlative max:area|min:area|max:population|min:population|max:border-count
 *        (after filtering, return only the single top entity)
 *
 * Example (Kazakhstan): --landlocked true --borders China --superlative max:area
 *
 * Usage: node tools/acquisition/verify-clue-uniqueness.mjs [constraints]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const store = JSON.parse(
  await fs.readFile(path.join(process.cwd(), 'data', 'sourcing', 'facts', 'geography-countries.json'), 'utf8'),
);
let pool = store.countries;

const has = (k) => args[k] !== undefined;
const lc = (s) => String(s).toLowerCase();
const list = (k) => (Array.isArray(args[k]) ? args[k] : has(k) ? [args[k]] : []);

if (has('landlocked')) pool = pool.filter((c) => c.landlocked === (args.landlocked === 'true' || args.landlocked === true));
if (has('continent')) pool = pool.filter((c) => c.continents.some((x) => lc(x).includes(lc(args.continent))));
if (has('capital')) pool = pool.filter((c) => c.capital && lc(c.capital).includes(lc(args.capital)));
for (const b of list('borders')) pool = pool.filter((c) => c.borders.some((x) => lc(x).includes(lc(b))));
for (const b of list('not-borders')) pool = pool.filter((c) => !c.borders.some((x) => lc(x).includes(lc(b))));
if (has('border-count')) pool = pool.filter((c) => cmp(c.borders.length, String(args['border-count'])));
if (has('min-area')) pool = pool.filter((c) => c.area_km2 != null && c.area_km2 >= Number(args['min-area']));
if (has('max-area')) pool = pool.filter((c) => c.area_km2 != null && c.area_km2 <= Number(args['max-area']));
if (has('min-pop')) pool = pool.filter((c) => c.population != null && c.population >= Number(args['min-pop']));
if (has('max-pop')) pool = pool.filter((c) => c.population != null && c.population <= Number(args['max-pop']));

if (has('superlative')) {
  const [dir, fieldRaw] = String(args.superlative).split(':');
  const field = { area: 'area_km2', population: 'population', 'border-count': null }[fieldRaw];
  const valueOf = (c) => (fieldRaw === 'border-count' ? c.borders.length : c[field]);
  const ranked = pool.filter((c) => valueOf(c) != null).sort((a, b) => (dir === 'min' ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a)));
  pool = ranked.slice(0, 1);
}

console.log(`Matches: ${pool.length}`);
for (const c of pool.slice(0, 25)) {
  console.log(
    `  ${c.name}  [area #${c.area_rank ?? '-'}, pop #${c.population_rank ?? '-'}, ${c.borders.length} borders${c.landlocked ? ', landlocked' : ''}]  cap: ${c.capital ?? '-'}`,
  );
}
console.log(pool.length === 1 ? '\n✓ UNIQUE — safe to ship.' : pool.length === 0 ? '\n✗ No match — loosen constraints.' : '\n✗ AMBIGUOUS — tighten constraints before shipping.');

function cmp(n, expr) {
  if (expr.startsWith('>=')) return n >= Number(expr.slice(2));
  if (expr.startsWith('<=')) return n <= Number(expr.slice(2));
  if (expr.startsWith('>')) return n > Number(expr.slice(1));
  if (expr.startsWith('<')) return n < Number(expr.slice(1));
  return n === Number(expr);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1]?.startsWith('--') ? true : argv[i + 1] ?? true;
    if (parsed[key] !== undefined) parsed[key] = [].concat(parsed[key], value);
    else parsed[key] = value;
    if (value !== true) i += 1;
  }
  return parsed;
}
