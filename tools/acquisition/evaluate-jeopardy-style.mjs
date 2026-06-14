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

const rows = await request('/rest/v1/questions?select=id,source,category_id,value,mechanic,clue,answer,aliases,tags&is_active=eq.true&limit=5000');
const evaluated = rows.map((row) => ({ ...row, style: scoreQuestion(row) }));
const categories = groupBy(evaluated, (row) => row.category_id);
const sources = groupBy(evaluated, (row) => row.source);

const summary = {
  generated_at: new Date().toISOString(),
  total_active: evaluated.length,
  overall: summarize(evaluated),
  by_category: Object.fromEntries(Object.entries(categories).sort().map(([key, items]) => [key, summarize(items)])),
  by_source: Object.fromEntries(Object.entries(sources).sort().map(([key, items]) => [key, summarize(items)])),
  issue_counts: issueCounts(evaluated),
  weakest_samples: evaluated
    .toSorted((a, b) => a.style.score - b.style.score)
    .slice(0, 25)
    .map((row) => ({
      id: row.id,
      source: row.source,
      category_id: row.category_id,
      value: row.value,
      score: row.style.score,
      issues: row.style.issues,
    })),
};

const outputPath = path.join(process.cwd(), 'data', 'acquisition', 'jeopardy-style-evaluation.json');
await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));
console.log(`Wrote ${outputPath}`);
console.log(`Evaluated ${evaluated.length} active questions.`);
console.log(`Overall average score: ${summary.overall.average_score}`);

function scoreQuestion(row) {
  const clue = row.clue.trim();
  const lower = clue.toLowerCase();
  const words = clue.split(/\s+/).filter(Boolean).length;
  const issues = [];
  let score = 100;

  if (/\?$/.test(clue)) {
    score -= 18;
    issues.push('direct-question-form');
  }

  if (/^(what|who|which|when|where|why|how)\b/i.test(clue)) {
    score -= 25;
    issues.push('starts-with-interrogative');
  }

  if (/which (of the following|one of these|of these|of the)\b/i.test(clue)) {
    score -= 35;
    issues.push('multiple-choice-shaped');
  }

  if (/\bthis number (answers how many|of)\b/i.test(clue)) {
    score -= 28;
    issues.push('ambiguous-number-rewrite');
  }

  if (/\bverb mood\b/i.test(clue)) {
    score -= 28;
    issues.push('grammar-jargon');
  }

  if (['true', 'false'].includes(row.answer.toLowerCase())) {
    score -= 45;
    issues.push('true-false-answer');
  }

  if (!/\b(this|these|that|it|its|he|she|his|her|their|in|on|from|after|before|according|title|named|called|known|seen|shown|heard)\b/i.test(clue)) {
    score -= 15;
    issues.push('weak-clue-anchor');
  }

  if (!/\b(1[0-9]{3}|20[0-9]{2}|[A-Z][a-z]{2,}|\"|“|”|&|named|called|known|title|wrote|created|founded|won|born|died)\b/.test(clue)) {
    score -= 10;
    issues.push('low-specificity');
  }

  if (words < 7) {
    score -= 8;
    issues.push('too-short');
  } else if (words > 34) {
    score -= 8;
    issues.push('too-long');
  }

  if ((row.aliases ?? []).length === 0 && row.answer.split(/\s+/).length > 1) {
    score -= 4;
    issues.push('missing-aliases-for-multiword-answer');
  }

  if (row.source === 'opentdb') {
    score -= 8;
    issues.push('provider-wording');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    tier: score >= 80 ? 'strong' : score >= 65 ? 'usable' : score >= 45 ? 'weak' : 'bad-fit',
    issues,
  };
}

function summarize(items) {
  const total = items.length;
  const average = total ? Math.round(items.reduce((sum, row) => sum + row.style.score, 0) / total) : 0;
  return {
    count: total,
    average_score: average,
    strong: items.filter((row) => row.style.tier === 'strong').length,
    usable: items.filter((row) => row.style.tier === 'usable').length,
    weak: items.filter((row) => row.style.tier === 'weak').length,
    bad_fit: items.filter((row) => row.style.tier === 'bad-fit').length,
  };
}

function issueCounts(items) {
  const counts = {};
  for (const item of items) {
    for (const issue of item.style.issues) {
      counts[issue] = (counts[issue] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
}

async function request(endpoint) {
  const response = await fetch(`${supabaseUrl}${endpoint}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${endpoint} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
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
