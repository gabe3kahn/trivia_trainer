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

const fixes = [
  {
    id: '4cbf20a2-1a5e-41c9-8133-cdde3fdc8dd4',
    clue: 'This pistol model was designed in the year named by its designation.',
    answer: '1911',
    aliases: ['1911'],
    value: 400,
  },
  {
    id: 'a02cbff3-2118-4674-b2a6-628af9412e1d',
    clue: 'The Antarctic Treaty leaves no sovereign nation owning this icy southern continent.',
    answer: 'Antarctica',
    aliases: ['Antarctica'],
    value: 400,
  },
  {
    id: '0ffe4de2-43f3-4a15-83af-023e29996896',
    clue: 'The Battle of the Somme in World War I took place in this country.',
    answer: 'France',
    aliases: ['France'],
    value: 400,
  },
  {
    id: 'a7509a05-d0c2-468b-9eef-eb47c75222e1',
    clue: 'In competitive Counter-Strike: Global Offensive, this pistol is the Terrorist side starting weapon.',
    answer: 'Glock-18',
    aliases: ['Glock-18', 'Glock 18'],
    value: 400,
  },
];

const updates = [];

for (const fix of fixes) {
  const existing = await request(`/rest/v1/questions?select=*&id=eq.${fix.id}&limit=1`);
  if (!existing.length) {
    console.warn(`Question not found, skipping: ${fix.id}`);
    continue;
  }

  const previous = existing[0];
  const next = { ...previous, ...fix, difficulty_rank: valueToRank(fix.value) };
  const quality = auditQuestion(next);
  const body = {
    clue: fix.clue,
    answer: fix.answer,
    aliases: fix.aliases,
    value: fix.value,
    difficulty_rank: valueToRank(fix.value),
    quality_status: quality.decision,
    quality_score: quality.score,
    quality_issues: quality.issues,
  };

  await request(`/rest/v1/questions?id=eq.${fix.id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { Prefer: 'return=minimal' },
  });

  updates.push({ id: fix.id, previous: { clue: previous.clue, answer: previous.answer, value: previous.value }, next: body });
}

const reportPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `syntax-cleanup-pass-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(reportPath, JSON.stringify({ count: updates.length, updates }, null, 2));
console.log(`Applied ${updates.length} syntax cleanup rewrites.`);
console.log(`Report: ${reportPath}`);

function valueToRank(value) {
  return ({ 200: 1, 400: 2, 600: 3, 800: 4, 1000: 5 })[Number(value)] ?? 2;
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
