import fs from 'node:fs/promises';
import path from 'node:path';

await loadEnvFile(path.join(process.cwd(), '.env.local'));
await loadEnvFile(path.join(process.cwd(), '.env'));
await loadEnvFile(path.join(process.cwd(), 'mobile', '.env'));

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase admin credentials.');
}

const mappings = [
  { tag: 'easy', value: 200, difficulty_rank: 1 },
  { tag: 'medium', value: 400, difficulty_rank: 2 },
  { tag: 'hard', value: 800, difficulty_rank: 4 },
];

const updates = [];

for (const mapping of mappings) {
  const rows = await request(
    `/rest/v1/questions?select=id,value,difficulty_rank&source=eq.opentdb&tags=cs.{${mapping.tag}}&is_active=eq.true&limit=2000`,
  );

  for (const row of rows) {
    if (row.value === mapping.value && row.difficulty_rank === mapping.difficulty_rank) continue;
    await request(`/rest/v1/questions?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        value: mapping.value,
        difficulty_rank: mapping.difficulty_rank,
      }),
      headers: { Prefer: 'return=minimal' },
    });
    updates.push({
      id: row.id,
      previous_value: row.value,
      next_value: mapping.value,
      tag: mapping.tag,
    });
  }
}

const reportPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `provider-difficulty-recalibration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(reportPath, JSON.stringify({ count: updates.length, updates }, null, 2));
console.log(`Recalibrated ${updates.length} OpenTDB rows.`);
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
