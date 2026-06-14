import fs from 'node:fs/promises';
import path from 'node:path';
import { auditQuestion } from './question-quality-rules.mjs';

await loadEnvFile(path.join(process.cwd(), '.env.local'));
await loadEnvFile(path.join(process.cwd(), '.env'));
await loadEnvFile(path.join(process.cwd(), 'mobile', '.env'));

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase admin credentials.');
}

const rows = await request(
  '/rest/v1/questions?select=id,source,category_id,subcategories(name),value,mechanic,constraint_text,clue,answer,aliases,tags,quality_issues&source=eq.original_topoff_pack&quality_status=neq.keep&is_active=eq.true&limit=1000',
);

const updates = [];
for (const row of rows) {
  const nextClue = polishClue(row);
  const quality = auditQuestion({ ...row, clue: nextClue });

  updates.push({
    id: row.id,
    previous_clue: row.clue,
    next_clue: nextClue,
    quality,
  });

  await request(`/rest/v1/questions?id=eq.${row.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      clue: nextClue,
      quality_status: quality.decision,
      quality_score: quality.score,
      quality_issues: quality.issues,
    }),
    headers: { Prefer: 'return=minimal' },
  });
}

const reportPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `topoff-polish-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(reportPath, JSON.stringify({ count: updates.length, updates }, null, 2));
console.log(`Polished ${updates.length} topoff rows.`);
console.log(`Report: ${reportPath}`);
console.log(formatQualityCounts(updates));

function polishClue(row) {
  if (row.clue === 'This SI unit named for a French physicist measures electric current.') {
    return 'In SI measurement, this unit named for a French physicist measures electric flow.';
  }

  if (row.answer === 'Richter scale') {
    return 'Named for Charles Richter, this scale measures earthquake magnitude.';
  }

  if (!(row.quality_issues ?? []).includes('thin-clue')) return row.clue;

  const frame = categoryFrame(row.category_id);
  const lower = row.clue.charAt(0).toLowerCase() + row.clue.slice(1);
  return `${frame}, ${lower}`;
}

function categoryFrame(categoryId) {
  return {
    arts_visual_culture: 'In art history',
    geography: 'In geography',
    history: 'In history',
    language_wordplay: 'In wordplay',
    literature_books: 'In literature',
    music_performing_arts: 'In music and theater',
    pop_culture_media_modern_life: 'In modern culture',
    religion_mythology_philosophy: 'In religion and philosophy',
    science: 'In science',
    sports_games_leisure: 'In sports and games',
  }[categoryId] ?? 'In trivia';
}

function formatQualityCounts(items) {
  const counts = {};
  for (const item of items) {
    counts[item.quality.decision] = (counts[item.quality.decision] ?? 0) + 1;
  }
  return ['keep', 'rewrite', 'replace', 'deactivate']
    .map((status) => `${status}=${counts[status] ?? 0}`)
    .join(', ');
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${supabaseUrl}${endpoint}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: options.body,
  });

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${endpoint} failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadEnvFile(filePath) {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      process.env[key] ||= valueParts.join('=').trim();
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
