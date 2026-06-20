/**
 * Source verifier: corroborate an authored clue's answer against reputable
 * reference sources and return a citation.
 *
 * The point is NOT a perfect oracle — it's a triage + citation layer. For each
 * clue we look up the answer in a reputable source, check that the clue's own
 * content words are corroborated on that source, and record a citation (URL +
 * snippet). A clue that can't be corroborated is flagged for human review
 * rather than silently trusted.
 *
 * Sources (pluggable):
 *   - Wikipedia  (default, factual answers)        — REST summary + search API
 *   - Wiktionary (definitions / language_wordplay) — stands in for the OED,
 *     which has no free API.
 *
 * No API key needed; Wikimedia just requires a descriptive User-Agent.
 */

const STOP = new Set(
  'a an the of in on at to for from with by and or as this that these those is are was were be been being it its his her their he she they them who what when where why how which one ofthe into over after before under during about more most than then them you your our we us not no yes can will would could should may might must do does did has have had named called known features include including used use first last new old great major minor famous'.split(
    ' ',
  ),
);

export function tokenize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function contentTerms(text) {
  return [...new Set(tokenize(text).filter((t) => t.length >= 4 && !STOP.has(t)))];
}

function corroboration(clue, sourceText) {
  const terms = contentTerms(clue);
  if (!terms.length) return { ratio: 0, matched: [], total: 0 };
  const hay = ` ${tokenize(sourceText).join(' ')} `;
  const matched = terms.filter((t) => hay.includes(` ${t} `));
  return { ratio: matched.length / terms.length, matched, total: terms.length };
}

function norm(value) {
  return tokenize(value).join(' ');
}

// Stable key for matching a Wikipedia title across calls (handles diacritics,
// case, underscores). Used to look up pre-batched lead intros in deps.introCache.
export function wikiTitleKey(value) {
  return tokenize(value).join(' ');
}

const CONSTRUCTED_MECHANICS = new Set(['anagram', 'before_after', 'rhyme_time', 'word_ladder', 'starts_with', 'ends_with', 'contains', 'crossword_clue']);

/**
 * deps.fetchJson(url) -> parsed JSON (caller injects fetch + UA + rate limiting).
 * Returns { status, confidence, citations: [...], matched, source, note }.
 *   status: 'verified' | 'weak' | 'unverified' | 'skipped'
 */
export async function verifyAnswer(question, deps) {
  const mechanic = question.mechanic ?? 'standard';

  // Constructed wordplay isn't a factual lookup — its correctness is structural.
  if (CONSTRUCTED_MECHANICS.has(mechanic)) {
    return { status: 'skipped', confidence: null, citations: [], note: `constructed-mechanic:${mechanic}` };
  }

  const isDefinition =
    question.category_id === 'language_wordplay' &&
    /\b(defin|word|term|vocab)/i.test([...(question.tags ?? []), question.subcategory_name ?? ''].join(' '));

  if (isDefinition) {
    const wikt = await verifyWiktionary(question, deps);
    if (wikt) return wikt;
    // fall through to Wikipedia if Wiktionary has nothing
  }

  return verifyWikipedia(question, deps);
}

// A Wikipedia /wiki/<Title> URL → decoded page title (spaces, not underscores),
// or null if it isn't a Wikipedia article URL. Lets us check the EXACT page the
// author cited, rather than re-resolving the bare answer (e.g. "Monopoly" resolves
// to the economics article, not the cited "Monopoly (game)").
export function wikiTitleFromUrl(url) {
  if (!url || !/wikipedia\.org\/wiki\//i.test(url)) return null;
  const seg = url.split('/wiki/')[1];
  if (!seg) return null;
  try {
    return decodeURIComponent(seg.split('#')[0]).replace(/_/g, ' ').trim() || null;
  } catch {
    return null;
  }
}

async function verifyWikipedia(question, deps) {
  // Prefer the page the author actually cited (source_url or an existing wikipedia
  // citation) so we corroborate against THAT article, not whatever the bare answer
  // name happens to resolve to. Falls back to answer + aliases as before.
  const citedUrl =
    question.source_url ||
    (question.citations ?? []).find((c) => /wikipedia/i.test(`${c.source ?? ''} ${c.url ?? ''}`))?.url;
  const pinnedTitle = wikiTitleFromUrl(citedUrl);
  const candidates = [...(pinnedTitle ? [pinnedTitle] : []), question.answer, ...(question.aliases ?? [])]
    .filter(Boolean)
    .filter((c, i, arr) => arr.findIndex((x) => norm(x) === norm(c)) === i);

  for (const candidate of candidates) {
    // Try the REST summary directly first — the answer is usually the exact page
    // title, so this resolves in one call and avoids the heavily rate-limited
    // search API. Only fall back to search on a miss or a disambiguation page.
    let summary = await wikiSummary(candidate, deps);
    if (!summary || !summary.extract || summary.type === 'disambiguation') {
      const title = await wikiSearchTopTitle(candidate, deps);
      summary = title ? await wikiSummary(title, deps) : null;
    }
    if (!summary || !summary.extract || summary.type === 'disambiguation') continue;

    // Corroborate against the FULLER lead intro too, not just the short REST summary.
    // Etymologies and origin legends often live in later lead paragraphs — e.g. the
    // Marathon page's first paragraph is only the distance; Michel Bréal and the Ancient
    // Greek story are in the second. Falls back to the summary alone if the intro fetch fails.
    const intro = await wikiIntro(summary.title, deps).catch(() => '');
    const corr = corroboration(question.clue, `${summary.title} ${summary.extract} ${intro}`);
    // Did we actually find the ANSWER as a citable entity? (page title matches
    // the answer, or the answer appears in the article summary)
    const answerMatch =
      norm(summary.title).includes(norm(question.answer)) ||
      norm(question.answer).includes(norm(summary.title)) ||
      ` ${norm(summary.extract)} `.includes(` ${norm(question.answer)} `);

    // answerMatch => the answer is real and citable, so never "unverified" just
    // because an oblique clue reuses few literal words. clue-term overlap then
    // separates "verified" (clue clearly fits) from "weak" (check clue wording).
    let status;
    if (answerMatch) {
      status = corr.ratio >= 0.3 ? 'verified' : 'weak';
    } else {
      status = corr.ratio >= 0.5 ? 'verified' : corr.ratio >= 0.25 ? 'weak' : 'unverified';
    }

    return {
      status,
      confidence: Number(corr.ratio.toFixed(2)),
      source: 'wikipedia',
      matched: corr.matched,
      citations: [
        {
          source: 'wikipedia',
          title: summary.title,
          url: summary.url,
          snippet: summary.extract.slice(0, 240),
        },
      ],
      note: answerMatch ? 'answer-matches-source' : 'answer-not-explicit-in-summary',
    };
  }

  return { status: 'unverified', confidence: 0, source: 'wikipedia', citations: [], note: 'no-wikipedia-page' };
}

async function verifyWiktionary(question, deps) {
  const word = String(question.answer ?? '').trim();
  const defs = await wiktDefinitions(word, deps);
  if (!defs || !defs.length) return null;

  const joined = defs.join(' ');
  const corr = corroboration(question.clue, joined);
  const status = corr.ratio >= 0.4 ? 'verified' : corr.ratio >= 0.2 ? 'weak' : 'unverified';

  return {
    status,
    confidence: Number(corr.ratio.toFixed(2)),
    source: 'wiktionary',
    matched: corr.matched,
    citations: [
      {
        source: 'wiktionary',
        title: word,
        url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
        snippet: joined.slice(0, 240),
      },
    ],
    note: 'definition-source',
  };
}

/* ----------------------------- source clients ---------------------------- */

async function wikiSearchTopTitle(query, deps) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(query)}`;
  const data = await deps.fetchJson(url);
  return data?.query?.search?.[0]?.title ?? null;
}

async function wikiSummary(title, deps) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const data = await deps.fetchJson(url);
  if (!data || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;
  return {
    title: data.title ?? title,
    extract: data.extract ?? '',
    type: data.type ?? 'standard',
    url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  };
}

// Full lead intro (all opening paragraphs) — richer than the one-paragraph REST summary,
// so facts below the fold (etymology, origin legends) can corroborate a clue.
async function wikiIntro(title, deps) {
  // Prefer the pre-batched intro (verify-clue-sources fetches them 20/request to
  // avoid the per-clue rate limit). Only fall back to a live call on a cache miss.
  const cached = deps.introCache?.get(wikiTitleKey(title));
  if (cached != null) return cached;
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
  const data = await deps.fetchJson(url);
  const pages = data?.query?.pages;
  if (!pages) return '';
  const first = Object.values(pages)[0];
  return String(first?.extract ?? '');
}

async function wiktDefinitions(word, deps) {
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.replace(/ /g, '_'))}`;
  const data = await deps.fetchJson(url);
  const en = data?.en;
  if (!Array.isArray(en)) return null;
  return en.flatMap((part) => (part.definitions ?? []).map((d) => String(d.definition ?? '').replace(/<[^>]+>/g, ' ')));
}
