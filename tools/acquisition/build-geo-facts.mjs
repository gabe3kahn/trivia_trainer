/**
 * Build a STRUCTURED, cited fact store for countries from Wikidata — the raw
 * material for clever combinatorial clues. Unlike the prose doc corpus, this is
 * typed attributes we can combine and check for uniqueness:
 *
 *   name, wikidata, capital, continents[], area_km2, population,
 *   landlocked(bool), borders[], area_rank, population_rank, citation
 *
 * One SPARQL call. Output: data/sourcing/facts/geography-countries.json
 *
 * Usage: node tools/acquisition/build-geo-facts.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const SPARQL = `SELECT ?c ?cLabel (SAMPLE(?area) AS ?a) (SAMPLE(?pop) AS ?p) (SAMPLE(?capLabel) AS ?cap)
  (GROUP_CONCAT(DISTINCT ?contLabel; separator=", ") AS ?cont)
  (GROUP_CONCAT(DISTINCT ?borderLabel; separator=", ") AS ?borders)
  (SAMPLE(?ll) AS ?landlocked)
WHERE {
  ?c wdt:P463 wd:Q1065 .
  FILTER NOT EXISTS { ?c wdt:P576 ?dissolved. }          # exclude former/dissolved states (e.g. USSR)
  BIND(EXISTS { ?c wdt:P31/wdt:P279* wd:Q123480 } AS ?ll) # landlocked incl. doubly-landlocked subclasses
  OPTIONAL { ?c wdt:P2046 ?area. }
  OPTIONAL { ?c wdt:P1082 ?pop. }
  OPTIONAL { ?c wdt:P36 ?capx. ?capx rdfs:label ?capLabel. FILTER(lang(?capLabel)="en") }
  OPTIONAL { ?c wdt:P30 ?contx. ?contx rdfs:label ?contLabel. FILTER(lang(?contLabel)="en") }
  OPTIONAL { ?c wdt:P47 ?bx. ?bx rdfs:label ?borderLabel. FILTER(lang(?borderLabel)="en") }
  ?c rdfs:label ?cLabel. FILTER(lang(?cLabel)="en")
}
GROUP BY ?c ?cLabel`;

const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(SPARQL)}`;
const response = await fetch(url, {
  headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'TriviaTrainerFacts/0.1 (personal study app)' },
});
if (!response.ok) throw new Error(`Wikidata ${response.status}`);
const data = await response.json();

const countries = data.results.bindings.map((row) => {
  const qid = row.c.value.split('/').pop();
  const splitList = (v) => (v ? v.split(', ').map((s) => s.trim()).filter(Boolean) : []);
  return {
    name: row.cLabel.value,
    wikidata: qid,
    capital: row.cap?.value ?? null,
    continents: splitList(row.cont?.value),
    area_km2: row.a ? Math.round(Number(row.a.value)) : null,
    population: row.p ? Math.round(Number(row.p.value)) : null,
    landlocked: row.landlocked?.value === 'true',
    borders: splitList(row.borders?.value),
    citation: { source: 'wikidata', title: row.cLabel.value, url: `https://www.wikidata.org/wiki/${qid}` },
  };
});

// Derived ranks (1 = largest / most populous).
rank(countries, 'area_km2', 'area_rank');
rank(countries, 'population', 'population_rank');

const outDir = path.join(process.cwd(), 'data', 'sourcing', 'facts');
await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'geography-countries.json');
await fs.writeFile(
  outPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      source: 'wikidata',
      note: 'UN member states (P463/Q1065). landlocked = instance of Q123480. borders = P47. Each country cites its Wikidata entity.',
      count: countries.length,
      countries: countries.sort((a, b) => a.name.localeCompare(b.name)),
    },
    null,
    2,
  ),
);

console.log(`Wrote ${countries.length} country fact records → ${outPath}`);
const landlocked = countries.filter((c) => c.landlocked).length;
console.log(`landlocked: ${landlocked} | with capital: ${countries.filter((c) => c.capital).length} | with area: ${countries.filter((c) => c.area_km2).length}`);

function rank(list, field, rankField) {
  const sorted = list.filter((c) => c[field] != null).sort((a, b) => b[field] - a[field]);
  sorted.forEach((c, i) => {
    c[rankField] = i + 1;
  });
}
