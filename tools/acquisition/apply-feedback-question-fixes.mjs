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
    id: 'f5118f47-23d6-4a86-b9d6-685349159acf',
    clue: "Moore's law originally predicted the transistor count on integrated circuits would double after this many years.",
    answer: 'Two years',
    aliases: ['2 years', 'two years', '24 months'],
    value: 400,
    difficulty_rank: 2,
  },
  {
    id: '8bf1d2a2-eb20-4bea-89b7-feded0e9239d',
    clue: 'This colossal figure in New York Harbor was a gift from France.',
    answer: 'Statue of Liberty',
    aliases: ['the Statue of Liberty'],
    value: 200,
    difficulty_rank: 1,
  },
  {
    id: '3fde99b0-7b86-47a2-9626-af321537e853',
    clue: 'In this idiom, delaying action is kicking the can farther down this.',
    answer: 'Road',
    aliases: ['road'],
    value: 200,
    difficulty_rank: 1,
  },
  {
    id: 'feb290c0-bee0-4013-baf7-7835232f0b80',
    clue: 'Albrecht Durer was born and died in this German city.',
    answer: 'Nurnberg',
    aliases: ['Nuremberg', 'Nürnberg', 'Nurnberg'],
    value: 800,
    difficulty_rank: 4,
  },
  {
    id: 'd979a282-598e-42be-b894-ff30edb43cdd',
    clue: 'Megadeth released the album "Peace Sells but Who\'s Buying?" in this year.',
    answer: '1986',
    aliases: ['1986'],
    value: 400,
    difficulty_rank: 2,
  },
];

const updates = [];

for (const fix of fixes) {
  const existing = await request(`/rest/v1/questions?select=*&id=eq.${fix.id}&limit=1`);
  if (!existing.length) throw new Error(`Question not found: ${fix.id}`);

  const previous = existing[0];
  const next = {
    ...previous,
    clue: fix.clue,
    answer: fix.answer,
    aliases: fix.aliases,
    value: fix.value,
    difficulty_rank: fix.difficulty_rank,
  };
  const quality = auditQuestion(next);
  const body = {
    clue: fix.clue,
    answer: fix.answer,
    aliases: fix.aliases,
    value: fix.value,
    difficulty_rank: fix.difficulty_rank,
    quality_status: quality.decision,
    quality_score: quality.score,
    quality_issues: quality.issues,
  };

  await request(`/rest/v1/questions?id=eq.${fix.id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { Prefer: 'return=minimal' },
  });

  updates.push({
    id: fix.id,
    previous: {
      clue: previous.clue,
      answer: previous.answer,
      aliases: previous.aliases,
      value: previous.value,
    },
    next: body,
  });
}

const reportPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `feedback-question-fixes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(reportPath, JSON.stringify({ count: updates.length, updates }, null, 2));
console.log(`Applied ${updates.length} question fixes.`);
console.log(`Report: ${reportPath}`);

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
