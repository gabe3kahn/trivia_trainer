import fs from 'node:fs/promises';
import path from 'node:path';

export async function loadDefaultEnv(rootDir = process.cwd()) {
  await loadEnvFile(path.join(rootDir, '.env.local'));
  await loadEnvFile(path.join(rootDir, '.env'));
  await loadEnvFile(path.join(rootDir, 'mobile', '.env'));
}

export function getSupabaseAdminConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (serviceRoleKey.startsWith('sb_publishable_') || serviceRoleKey.startsWith('sb_public_')) {
    throw new Error('This script needs the secret service_role key, not the publishable/anon key.');
  }

  return { supabaseUrl, serviceRoleKey };
}

export function createSupabaseRequest({ supabaseUrl, serviceRoleKey }) {
  return async function request(endpoint, options = {}) {
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
  };
}

export async function fetchAllSupabaseRows(request, endpoint, { pageSize = 1000 } = {}) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const page = await request(endpoint, {
      headers: {
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export function formatQualityCounts(counts) {
  return ['keep', 'rewrite', 'replace', 'deactivate']
    .map((status) => `${status}=${counts[status] ?? 0}`)
    .join(', ');
}

export function formatDifficultyCounts(counts) {
  const entries = Object.entries(counts);
  return entries.length ? entries.map(([key, value]) => `${key}=${value}`).join(', ') : 'none';
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
