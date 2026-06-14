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
    id: '0fe23131-8404-468c-a957-fdaee47a1edb',
    clue: 'Domestic rabbits typically live this many years on average.',
    answer: '8 to 12 years',
    aliases: ['8-12 years', '8 to 12 years', 'eight to twelve years'],
    value: 400,
  },
  {
    id: '8f3d1dfc-769e-42c0-a15f-6a57b4afec46',
    clue: 'This abbreviation for a written draft appears in publishing and library catalogs.',
    answer: 'MS',
    aliases: ['MS', 'manuscript'],
    value: 600,
  },
  {
    id: 'b3148ea2-5f81-47a9-add3-19221e2478b3',
    clue: "This Manhattan museum's name is shortened to MoMA.",
    answer: 'Museum of Modern Art',
    aliases: ['Museum of Modern Art', 'the Museum of Modern Art'],
    value: 400,
  },
  {
    id: 'b5dc9798-22f1-4197-bc85-66c8971f2b15',
    clue: 'This Hokusai woodblock print shows stormy water near Mount Fuji.',
    answer: 'The Great Wave off Kanagawa',
    aliases: ['Great Wave off Kanagawa'],
    value: 400,
  },
  {
    id: '7525d899-6856-4385-a181-b49926b4eac2',
    clue: 'This translucent ceramic is used for fine tableware and electrical insulators.',
    answer: 'Porcelain',
    aliases: ['porcelain'],
    value: 400,
  },
  {
    id: 'bdda0449-670e-4abc-aa9a-1f1785ad2df3',
    clue: 'The Watergate scandal began with a break-in during this presidential election year.',
    answer: '1972',
    aliases: ['1972'],
    value: 400,
  },
  {
    id: '99ae1d0a-3f20-46a0-a776-e7bc9712a2a7',
    clue: 'In this idiom, stopping work means calling it this.',
    answer: 'Day',
    aliases: ['day', 'a day'],
    value: 200,
  },
];

const updates = [];

for (const fix of fixes) {
  const existing = await request(`/rest/v1/questions?select=*&id=eq.${fix.id}&limit=1`);
  if (!existing.length) throw new Error(`Question not found: ${fix.id}`);
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
  `rewrite-cleanup-pass-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(reportPath, JSON.stringify({ count: updates.length, updates }, null, 2));
console.log(`Applied ${updates.length} cleanup rewrites.`);
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
