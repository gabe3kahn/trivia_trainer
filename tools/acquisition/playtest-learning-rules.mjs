import { valueToRank } from './difficulty-rules.mjs';

export function auditPlaytestLearnings(row) {
  const clue = cleanText(row.clue);
  const answer = cleanText(row.answer);
  const aliases = row.aliases ?? [];
  const issues = [];
  const fixes = {};

  const duplicatePhrase = findDuplicateOpeningPhrase(clue);
  if (duplicatePhrase) {
    issues.push({
      code: 'duplicate-opening-phrase',
      severity: 10,
      note: `Repeated phrase "${duplicatePhrase}".`,
      auto_fix: true,
    });
    fixes.clue = clue.replace(new RegExp(`^${escapeRegex(duplicatePhrase)},\\s+${escapeRegex(duplicatePhrase)},\\s+`, 'i'), `${duplicatePhrase}, `);
  }

  if (/\bfrom what album\b/i.test(clue) && row.value <= 200) {
    issues.push({
      code: 'album-recall-undervalued',
      severity: 8,
      note: 'Exact album recall is too specialized for $200 without a very strong hook.',
      auto_fix: true,
    });
    fixes.value = Math.max(row.value, 400);
    fixes.difficulty_rank = valueToRank(fixes.value);
  }

  if (/\bRed Hot Chilli Peppers\b/i.test(answer)) {
    issues.push({
      code: 'canonical-name-misspelling',
      severity: 10,
      note: 'Canonical band name should be "Red Hot Chili Peppers".',
      auto_fix: true,
    });
    fixes.answer = 'Red Hot Chili Peppers';
    fixes.aliases = uniqueAliases([...aliases, answer]);
  }

  if (/\bRed Hot Chili Pepper song\b/i.test(clue)) {
    issues.push({
      code: 'canonical-name-singularized',
      severity: 8,
      note: 'Band name should be plural: Red Hot Chili Peppers.',
      auto_fix: true,
    });
    fixes.clue = (fixes.clue ?? clue).replace(/\bRed Hot Chili Pepper song\b/i, 'Red Hot Chili Peppers song');
  }

  if (isNicheGameTypeClue(clue, answer) && row.value <= 400) {
    issues.push({
      code: 'niche-game-type-undervalued',
      severity: 8,
      note: 'Specific TCG/video-game subtype recall is specialized and should not sit at low values.',
      auto_fix: true,
    });
    fixes.value = Math.max(row.value, 800);
    fixes.difficulty_rank = valueToRank(fixes.value);
  }

  const broaderTypeAlias = inferBroaderTypeAlias(answer);
  if (broaderTypeAlias && !hasAlias(row, broaderTypeAlias)) {
    issues.push({
      code: 'missing-broader-type-alias',
      severity: 7,
      note: `Broader response "${broaderTypeAlias}" should be accepted or at least considered close.`,
      auto_fix: true,
    });
    fixes.aliases = uniqueAliases([...aliases, broaderTypeAlias]);
  }

  if (row.value <= 400 && isLongSpecialistAnswer(row, answer)) {
    issues.push({
      code: 'low-value-long-specialist-answer',
      severity: 6,
      note: 'Long specialist answer form is likely harder than its current value.',
      auto_fix: row.value <= 200,
    });
    if (row.value <= 200) {
      fixes.value = Math.max(fixes.value ?? row.value, 400);
      fixes.difficulty_rank = valueToRank(fixes.value);
    }
  }

  const commonAlias = shortestUsefulAlias(row);
  if (commonAlias && answer.length >= 20 && commonAlias.length <= 8) {
    issues.push({
      code: 'common-short-answer-form-available',
      severity: 5,
      note: `Short alias "${commonAlias}" may be the player-facing answer form.`,
      auto_fix: false,
    });
  }

  const hasAutoFix = Object.keys(fixes).length > 0;
  return {
    severity: issues.reduce((sum, issue) => sum + issue.severity, 0),
    issues,
    fixes: hasAutoFix ? normalizeFixes(row, fixes, issues) : null,
  };
}

function normalizeFixes(row, fixes, issues) {
  const qualityIssues = uniqueAliases([
    ...(row.quality_issues ?? []),
    ...issues.map((issue) => `playtest-learning: ${issue.code}`),
  ]);

  return {
    ...fixes,
    quality_issues: qualityIssues,
  };
}

function findDuplicateOpeningPhrase(clue) {
  const match = clue.match(/^([^,]{3,40}),\s+\1,\s+/i);
  return match?.[1] ?? null;
}

function isNicheGameTypeClue(clue, answer) {
  return /\b(Yugioh|Yu-Gi-Oh|Trading Card Game|TCG|Magic: The Gathering|Pokemon TCG)\b/i.test(clue) &&
    /\b(type|card|trap|spell|creature|instant|sorcery|enchantment)\b/i.test(`${clue} ${answer}`);
}

function inferBroaderTypeAlias(answer) {
  const normalized = cleanText(answer);
  const cardMatch = normalized.match(/^(counter|normal|continuous|quick play|quick-play|field|equip|ritual)\s+(trap|spell|card)$/i);
  if (cardMatch) {
    const base = titleCase(cardMatch[2]);
    return base === 'Trap' || base === 'Spell' ? `${base} Card` : base;
  }
  return null;
}

function isLongSpecialistAnswer(row, answer) {
  const categoryText = `${row.category_id ?? ''} ${row.categories?.name ?? ''} ${row.subcategories?.name ?? ''} ${(row.tags ?? []).join(' ')}`;
  const specialistCategory = /\b(video games|board games|card games|popular music|music theory|earth science|grammar|homophones|rules|terminology|anime|manga|esports)\b/i.test(categoryText);
  const longForm = answer.split(/\s+/).length >= 3 || answer.length >= 24;
  const exactDetailClue = /\b(full name|middle name|last name|album|type|version|model|entry|episode|released|debuted)\b/i.test(row.clue ?? '');
  return specialistCategory && longForm && exactDetailClue;
}

function shortestUsefulAlias(row) {
  return (row.aliases ?? [])
    .map(cleanText)
    .filter((alias) => alias.length >= 3 && alias.toLowerCase() !== cleanText(row.answer).toLowerCase())
    .toSorted((a, b) => a.length - b.length)[0] ?? null;
}

function hasAlias(row, alias) {
  const wanted = normalize(alias);
  return [row.answer, ...(row.aliases ?? [])].some((value) => normalize(value) === wanted);
}

function uniqueAliases(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const cleaned = cleanText(value);
    const key = normalize(cleaned);
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
