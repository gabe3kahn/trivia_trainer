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

const rows = await request('/rest/v1/questions?select=id,external_id,category_id,clue,answer,tags&source=eq.opentdb&is_active=eq.true&limit=5000');
const badRows = rows.filter((row) => isBadProviderQuestion(row));

for (const row of badRows) {
  await request(`/rest/v1/questions?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ is_active: false }),
  });
}

console.log(`Scanned ${rows.length} active OpenTDB rows.`);
console.log(`Deactivated ${badRows.length} rows that are true/false or multiple-choice-shaped.`);

function isBadProviderQuestion(row) {
  const clue = row.clue.toLowerCase();
  const answer = row.answer.toLowerCase();
  const tags = row.tags ?? [];

  return (
    tags.includes('boolean')
    || answer === 'true'
    || answer === 'false'
    || clue.includes('which of the following')
    || clue.includes('which one of these')
    || clue.includes('which of these')
    || clue.includes('which of the')
  );
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
