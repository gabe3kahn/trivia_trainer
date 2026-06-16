/**
 * Build a "name this painting" visual-clue pack. Curated to clearly PUBLIC-DOMAIN
 * works (artist long dead), so the Wikimedia Commons image is free to display.
 * Pulls each painting's lead image URL from the Wikipedia REST summary.
 *
 *   node tools/acquisition/build-visual-arts-pack.mjs
 */

import fs from 'node:fs/promises';

const WORKS = [
  { answer: 'Mona Lisa', title: 'Mona Lisa', artist: 'Leonardo da Vinci', value: 200, aliases: ['La Gioconda', 'La Joconde'] },
  { answer: 'The Starry Night', title: 'The Starry Night', artist: 'Vincent van Gogh', value: 200, aliases: ['Starry Night'] },
  { answer: 'Girl with a Pearl Earring', title: 'Girl with a Pearl Earring', artist: 'Johannes Vermeer', value: 400, aliases: [] },
  { answer: 'The Birth of Venus', title: 'The Birth of Venus', artist: 'Sandro Botticelli', value: 400, aliases: ['Birth of Venus'] },
  { answer: 'The Night Watch', title: 'The Night Watch', artist: 'Rembrandt', value: 600, aliases: [] },
  { answer: 'The Great Wave off Kanagawa', title: 'The Great Wave off Kanagawa', artist: 'Hokusai', value: 400, aliases: ['The Great Wave', 'Great Wave off Kanagawa'] },
  { answer: 'A Sunday Afternoon on the Island of La Grande Jatte', title: 'A Sunday Afternoon on the Island of La Grande Jatte', artist: 'Georges Seurat', value: 600, aliases: ['La Grande Jatte', 'A Sunday on La Grande Jatte'] },
  { answer: "Whistler's Mother", title: "Whistler's Mother", artist: 'James McNeill Whistler', value: 400, aliases: ['Arrangement in Grey and Black No. 1'] },
];

function rank(v) { return { 200: 1, 400: 2, 600: 3, 800: 4, 1000: 5 }[v] || 2; }

// Surname for the artist alias, keeping a leading particle (van Gogh, da Vinci).
function surnameOf(name) {
  const parts = String(name).split(/\s+/);
  const particles = new Set(['van', 'von', 'de', 'da', 'del', 'della', 'di', 'du', 'le', 'la', 'der', 'ten', "d'"]);
  let i = parts.length - 1;
  if (i - 1 >= 0 && particles.has(parts[i - 1].toLowerCase())) i -= 1;
  return parts.slice(i).join(' ');
}

async function leadImage(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'TriviaTrainerVisualPack/0.1 (personal study app)', Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} for ${title}`);
  const d = await r.json();
  const img = d.originalimage?.source || d.thumbnail?.source || null;
  const page = d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  return { img, page };
}

const questions = [];
let i = 0;
for (const w of WORKS) {
  i += 1;
  const { img, page } = await leadImage(w.title);
  if (!img) { console.log(`  MISS  ${w.answer} (no lead image)`); continue; }
  // Alternate the prompt: odd index -> name the painting, even -> name the artist.
  const askArtist = i % 2 === 0;
  const surname = surnameOf(w.artist);
  const clue = askArtist ? 'Name the artist.' : 'Name this painting.';
  const answer = askArtist ? w.artist : w.answer;
  const aliases = askArtist ? (surname && surname !== w.artist ? [surname] : []) : w.aliases;
  questions.push({
    source: 'original_sourced',
    source_url: page,
    external_id: `visual-arts-001-${String(i).padStart(3, '0')}`,
    category_id: 'arts_visual_culture',
    subcategory_name: 'Famous Artworks',
    value: w.value,
    difficulty_rank: rank(w.value),
    mechanic: 'visual',
    constraint_text: null,
    clue,
    answer,
    aliases,
    tags: ['visual', 'sourced', 'famous-artworks'],
    citations: [{ source: 'wikipedia', title: w.title, url: page }],
    image_url: img,
    // No artist in the on-screen credit — it would leak the answer on "Name the
    // artist" clues, and public-domain works need no attribution anyway.
    image_attribution: 'Wikimedia Commons (public domain)',
    image_license: 'public-domain',
    answer_detail: `${w.answer} — ${w.artist}`,
    verification_status: 'verified',
  });
  console.log(`  OK    ${w.answer}  ->  ${img}`);
  await new Promise((res) => setTimeout(res, 300));
}

const pack = { generated_at: '2026-06-15', provider: 'original_sourced', category_id: 'arts_visual_culture', notes: ['Visual "name this painting" clues; public-domain works only; images via Wikimedia Commons.'], questions };
await fs.writeFile('data/sourcing/packs/drafts/visual-arts-001.json', JSON.stringify(pack, null, 2) + '\n');
console.log(`\nWrote ${questions.length} visual clues to data/sourcing/packs/drafts/visual-arts-001.json`);
