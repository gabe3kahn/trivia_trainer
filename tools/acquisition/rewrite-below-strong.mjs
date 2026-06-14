import fs from 'node:fs/promises';
import path from 'node:path';

await loadEnvFile(path.join(process.cwd(), '.env.local'));
await loadEnvFile(path.join(process.cwd(), '.env'));
await loadEnvFile(path.join(process.cwd(), 'mobile', '.env'));

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase admin credentials.');
}

const rows = await request('/rest/v1/questions?select=id,source,category_id,value,mechanic,clue,answer,aliases,tags&is_active=eq.true&limit=5000');
const candidates = rows
  .map((row) => ({ ...row, style: scoreQuestion(row) }))
  .filter((row) => row.style.score < 80);

const changed = [];
const unchanged = [];

for (const row of candidates) {
  const rewrite = rewriteQuestion(row);
  const nextAliases = improveAliases(row.answer, row.aliases ?? []);
  const update = {};

  if (rewrite && rewrite !== row.clue) update.clue = rewrite;
  if (JSON.stringify(nextAliases) !== JSON.stringify(row.aliases ?? [])) update.aliases = nextAliases;

  if (!Object.keys(update).length) {
    unchanged.push(row);
    continue;
  }

  changed.push({
    id: row.id,
    source: row.source,
    category_id: row.category_id,
    previous_score: row.style.score,
    previous_clue: row.clue,
    next_clue: update.clue ?? row.clue,
    previous_aliases: row.aliases ?? [],
    next_aliases: update.aliases ?? row.aliases ?? [],
  });

  if (!dryRun) {
    await request(`/rest/v1/questions?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(update),
    });
  }
}

const outputPath = path.join(process.cwd(), 'data', 'acquisition', `rewrite-below-strong-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
await fs.writeFile(outputPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  dry_run: dryRun,
  candidates: candidates.length,
  changed: changed.length,
  unchanged: unchanged.length,
  changes: changed,
}, null, 2));

console.log(`${dryRun ? 'Would update' : 'Updated'} ${changed.length} of ${candidates.length} below-strong active questions.`);
console.log(`Unchanged: ${unchanged.length}`);
console.log(`Wrote ${outputPath}`);

function rewriteQuestion(row) {
  let clue = row.clue.trim().replace(/\s+/g, ' ');
  const noQuestion = clue.replace(/\?+$/, '.').replace(/([^.!])$/, '$1.');

  const replacements = [
    [/^capital of Chile\.$/i, 'This city is the capital of Chile.'],
    [/^large body of salt water\.$/i, 'This is a large body of salt water.'],
    [/^opposite of (.+)\.$/i, 'This is the opposite of $1.'],
    [/^letter-shaped valley carved by glaciers\.$/i, 'This letter-shaped valley is carved by glaciers.'],
    [/^suffix meaning (.+)\.$/i, 'This suffix means $1.'],
    [/^Neptune's greek name was\.+$/i, "Neptune's Greek name was this."],
    [/^Trypophobia is the fear of\.$/i, 'Trypophobia is the fear of this.'],
    [/^where does (.+) take place\.$/i, '$1 takes place here.'],
    [/^where does (.+) get its title from\.$/i, '$1 gets its title from this.'],
    [/^where does (.+) come from\.$/i, '$1 comes from this.'],
    [/^where does (.+) originate from\.$/i, '$1 originates from here.'],
    [/^when does (.+) celebrate (.+)\.$/i, '$1 celebrates $2 on this date.'],
    [/^what's (.+)\.$/i, 'This is $1.'],
    [/^what does "([^"]+)" stand for\.$/i, 'These words are abbreviated "$1".'],
    [/^what does ([A-Z0-9]+) stand for\.$/i, 'These words are abbreviated $1.'],
    [/^what does the term ([A-Z0-9]+) stand for\.$/i, 'These words are abbreviated by the term $1.'],
    [/^what does the ([^.]+) button do\.$/i, 'The $1 button does this.'],
    [/^what does a milliner make and sell\.$/i, 'A milliner makes and sells these.'],
    [/^what major programming language does (.+) use\.$/i, '$1 uses this major programming language.'],
    [/^what Greek letter is used to signify (.+)\.$/i, 'This Greek letter is used to signify $1.'],
    [/^what game was used to advertise (.+)\.$/i, 'This game was used to advertise $1.'],
    [/^what album did (.+) release in (.+)\.$/i, '$1 released this album in $2.'],
    [/^what French sculptor designed (.+)\.$/i, 'This French sculptor designed $1.'],
    [/^what port does (.+) run on\.$/i, '$1 runs on this port.'],
    [/^what immense structure is referred to (.+)\.$/i, 'This immense structure is referred to $1.'],
    [/^what type is "(.+)" in (.+)\.$/i, '"$1" is this type in $2.'],
    [/^what country saw (.+)\.$/i, 'This country saw $1.'],
    [/^what city is known as (.+)\.$/i, 'This city is known as $1.'],
    [/^what dog breed is (.+)\.$/i, 'This dog breed is $1.'],
    [/^what special item did (.+) ship (.+)\.$/i, '$1 shipped this special item $2.'],
    [/^what do you declare in (.+) when (.+)\.$/i, 'In $1, you declare this when $2.'],
    [/^what happens when (.+)\.$/i, 'This happens when $1.'],
    [/^what position does (.+) play (.+)\.$/i, '$1 plays this position $2.'],
    [/^what island in (.+)\.$/i, 'This island in $1.'],
    [/^what musician made (.+)\.$/i, 'This musician made $1.'],
    [/^what internet protocol (.+)\.$/i, 'This internet protocol $1.'],
    [/^what prime number comes next after (.+)\.$/i, 'This prime number comes next after $1.'],
    [/^what comes after (.+)\.$/i, 'This comes after $1.'],
    [/^what numbers are in (.+)\.$/i, 'These numbers are in $1.'],
    [/^what book series (.+)\.$/i, 'This book series $1.'],
    [/^what ([a-z]+) creatures have (.+)\.$/i, 'These $1 creatures have $2.'],
    [/^what type of function is (.+)\.$/i, '$1 is this type of function.'],
    [/^what is the derivative of (.+)\.?$/i, 'This is the derivative of $1.'],
    [/^what is the name of (.+)\.$/i, 'This is the name of $1.'],
    [/^what was the name of (.+)\.$/i, 'This was the name of $1.'],
    [/^what mythological creatures have (.+)\.$/i, 'These mythological creatures have $1.'],
    [/^what weakpoint of Achilles was (.+)\.$/i, 'Achilles had this weak point, which was $1.'],
    [/^what nationality was (.+)\.$/i, '$1 was of this nationality.'],
    [/^what year was (.+) finished\.$/i, '$1 was finished in this year.'],
    [/^what year was (.+) released\.$/i, '$1 was released in this year.'],
    [/^what year was (.+) born in\.$/i, '$1 was born in this year.'],
    [/^what year was (.+) founded in\.$/i, '$1 was founded in this year.'],
    [/^what year did (.+) create (.+)\.$/i, '$1 created $2 in this year.'],
    [/^what year did (.+) Become President\.$/i, '$1 became President in this year.'],
    [/^what year did (.+) begin\.$/i, '$1 began in this year.'],
    [/^what year did (.+) end\.$/i, '$1 ended in this year.'],
    [/^what year did (.+) occur (.+)\.$/i, '$1 occurred $2 in this year.'],
    [/^what year was (.+)\.$/i, 'This year is when $1.'],
    [/^what year did (.+)\.$/i, 'This year is when $1.'],
    [/^what country is not (.+)\.$/i, 'This country is not $1.'],
    [/^what type of animal is (.+)\.$/i, '$1 is this type of animal.'],
    [/^what type of creature is (.+)\.$/i, '$1 is this type of creature.'],
    [/^what scientific family does (.+) belong to\.$/i, '$1 belongs to this scientific family.'],
    [/^what fast food chain (.+)\.$/i, 'This fast food chain $1.'],
    [/^what organ of the body (.+)\.$/i, 'This organ of the body $1.'],
    [/^what nation (.+)\.$/i, 'This nation $1.'],
    [/^what disease (.+)\.$/i, 'This disease $1.'],
    [/^what date (.+)\.$/i, 'This date $1.'],
    [/^what number does (.+) stand for\.$/i, '$1 stands for this number.'],
    [/^what number (.+)\.$/i, 'This number $1.'],
    [/^what tiny principality (.+)\.$/i, 'This tiny principality $1.'],
    [/^under what pseudonym did (.+) publish (.+)\.$/i, '$1 published $2 under this pseudonym.'],
    [/^for what reason would (.+) "laugh"\.$/i, '$1 would "laugh" for this reason.'],
    [/^for what reason would (.+)\.$/i, '$1 for this reason.'],
    [/^how many countries share (.+)\.$/i, 'This many countries share $1.'],
    [/^how many Millibars \(mbar\) to 1 Inch of Mercury \(inHg\)\.$/i, 'This many millibars equal 1 inch of mercury.'],
    [/^how long are (.+) combined\.$/i, '$1 are this long combined.'],
    [/^how tall is (.+)\.$/i, '$1 is this tall.'],
    [/^who is the protagonist of (.+)\.$/i, 'This character is the protagonist of $1.'],
    [/^what is (.+)\.$/i, 'This is $1.'],
    [/^what are (.+)\.$/i, 'These are $1.'],
    [/^what was (.+)\.$/i, 'This was $1.'],
    [/^what were (.+)\.$/i, 'These were $1.'],
    [/^what do (.+) call (.+)\.$/i, 'This is what $1 call $2.'],
    [/^what does (.+) represent\.$/i, '$1 represents this.'],
    [/^what did (.+) call (.+)\.$/i, 'This is what $1 called $2.'],
    [/^what ([a-z -]+) was featured in (.+)\.$/i, 'This $1 was featured in $2.'],
    [/^what ([a-z -]+) is featured in (.+)\.$/i, 'This $1 is featured in $2.'],
    [/^what colour is (.+)\.$/i, '$1 is this color.'],
    [/^what color is (.+)\.$/i, '$1 is this color.'],
    [/^who is (.+)\.$/i, 'This person is $1.'],
    [/^who was (.+)\.$/i, 'This person was $1.'],
    [/^who wrote (.+)\.$/i, 'This person wrote $1.'],
    [/^who created (.+)\.$/i, 'This person created $1.'],
    [/^who founded (.+)\.$/i, 'This person founded $1.'],
    [/^who did (.+) defeat (.+)\.$/i, '$1 defeated this person $2.'],
    [/^who painted (.+)\.$/i, 'This artist painted $1.'],
    [/^who sculpted (.+)\.$/i, 'This artist sculpted $1.'],
    [/^who composed (.+)\.$/i, 'This composer wrote $1.'],
    [/^who (.+)\.$/i, 'This person $1.'],
    [/^which animated film did (.+) direct in (.+)\.$/i, '$1 directed this animated film in $2.'],
    [/^which country (.+)\.$/i, 'This country $1.'],
    [/^which city (.+)\.$/i, 'This city $1.'],
    [/^which state (.+)\.$/i, 'This state $1.'],
    [/^which continent (.+)\.$/i, 'This continent $1.'],
    [/^which planet (.+)\.$/i, 'This planet $1.'],
    [/^which author (.+)\.$/i, 'This author $1.'],
    [/^which artist (.+)\.$/i, 'This artist $1.'],
    [/^which composer (.+)\.$/i, 'This composer $1.'],
    [/^which (.+)\.$/i, 'This $1.'],
    [/^where is (.+)\.$/i, 'This place is where $1.'],
    [/^where was (.+)\.$/i, 'This place was where $1.'],
    [/^when was (.+) released\.$/i, 'This is when $1 was released.'],
    [/^when was (.+)\.$/i, 'This date or year was when $1.'],
    [/^when did (.+)\.$/i, 'This date or year is when $1.'],
    [/^how many (.+) does (.+) have\.$/i, '$2 has this many $1.'],
    [/^how many (.+) are there in (.+)\.$/i, 'This many $1 are in $2.'],
    [/^how many (.+) were there in (.+)\.$/i, 'This many $1 were in $2.'],
    [/^how many (.+)\.$/i, 'This number answers how many $1.'],
    [/^what animal did (.+) sleep with before (.+)\.$/i, '$1 slept with this animal before $2.'],
    [/^in what year (.+)\.$/i, 'This year is when $1.'],
    [/^in what country (.+)\.$/i, 'This country is where $1.'],
    [/^in what city (.+)\.$/i, 'This city is where $1.'],
    [/^in what (.+)\.$/i, 'This $1.'],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(noQuestion)) {
      return cleanClue(noQuestion.replace(pattern, replacement));
    }
  }

  const embedded = rewriteEmbeddedQuestion(noQuestion);
  if (embedded !== noQuestion) return cleanClue(embedded);

  if (/\?$/.test(clue)) return cleanClue(noQuestion);
  return clue;
}

function cleanClue(clue) {
  const cleaned = clue
    .replace(/\bthis this\b/gi, 'this')
    .replace(/\bThis this\b/g, 'This')
    .replace(/\bThis is the capital of\b/g, 'This city is the capital of')
    .replace(/\bThis is the chemical symbol for\b/g, 'This is the chemical symbol for')
    .replace(/\bThis is radiation measured in\b/g, 'Radiation is measured in this unit')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/\bi\b/g, 'I')
    .trim();

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function rewriteEmbeddedQuestion(clue) {
  return clue
    .replace(/\bperformed what ([a-z][^.?]*?)\./i, 'performed this $1.')
    .replace(/\breviews which ([a-z][^.?]*?)\./i, 'reviews this $1.')
    .replace(/\bon which continent\./i, 'on this continent.')
    .replace(/\bbased on which culture\./i, 'based on this culture.')
    .replace(/\bwhich island nation\b/i, 'this island nation')
    .replace(/\bwhich Norse Mythological figure\b/i, 'this Norse mythological figure')
    .replace(/\bwhich time signature\b/i, 'this time signature')
    .replace(/\bwhich country\b/i, 'this country')
    .replace(/\bwhich U\.S\. president\b/i, 'this U.S. president')
    .replace(/\bwhich European royal house\b/i, 'this European royal house')
    .replace(/\bwhich musical family\b/i, 'this musical family')
    .replace(/\bwhich designer\b/i, 'this designer')
    .replace(/\bwhich author\b/i, 'this author')
    .replace(/\bwhich band\b/i, 'this band')
    .replace(/\bwhich Canadian act\b/i, 'this Canadian act')
    .replace(/\bwhich Eurodance group\b/i, 'this Eurodance group')
    .replace(/\bback half of what\./i, 'back half of this animal.')
    .replace(/\bof what\b/i, 'of this')
    .replace(/\bwhich instrument\b/i, 'this instrument')
    .replace(/\bwhose 2016 presidential campaign slogan\b/i, "this person's 2016 presidential campaign slogan")
    .replace(/\bwhat country was ruled\b/i, 'this country was ruled')
    .replace(/\bwhich marine creature\b/i, 'this marine creature')
    .replace(/\bcombat what\./i, 'combat this.')
    .replace(/\bwas written by\.+$/i, 'was written by this author.')
    .replace(/\bWhat does CMOS stand for\./i, 'CMOS stands for these words.')
    .replace(/\bfor what reason\b/i, 'for this reason')
    .replace(/\bunder what pseudonym\b/i, 'under this pseudonym')
    .replace(/\bfor what purpose\b/i, 'for this purpose')
    .replace(/\bwhat university\b/i, 'this university')
    .replace(/\bwhat board game\b/i, 'this board game')
    .replace(/\bwhat video game\b/i, 'this video game')
    .replace(/\bwhat classic horror story\b/i, 'this classic horror story')
    .replace(/\bwhat band\b/i, 'this band')
    .replace(/\bwhat album\b/i, 'this album')
    .replace(/\bwhat date\b/i, 'this date')
    .replace(/\bwhat type\b/i, 'this type')
    .replace(/\bwhat author\b/i, 'this author')
    .replace(/\bby whom\b/i, 'by this author')
    .replace(/\bhalf what\./i, 'half this animal.')
    .replace(/\bwhat would they mean\./i, 'they mean this.')
    .replace(/\bwhat kind of seeds\./i, 'these seeds.')
    .replace(/\bwhat movement\./i, 'this movement.')
    .replace(/\bwhat instrument\./i, 'this instrument.')
    .replace(/\bwhat university\./i, 'this university.')
    .replace(/\bevery how many years\./i, 'every this many years.')
    .replace(/\bwhat frequency is\b/i, 'this frequency is')
    .replace(/\bwhat unusual trick\b/i, 'this unusual trick')
    .replace(/\bwhat form of media\b/i, 'this form of media')
    .replace(/\bability is what\./i, 'ability is this.')
    .replace(/, who is ([^.]+)\./i, ', this character is $1.')
    .replace(/\bwhat is the name of ([^.]+)\./i, 'this is the name of $1.')
    .replace(/\bwhat do ([^.]+) consider ([^.]+)\./i, '$1 consider this $2.')
    .replace(/, who was ([^.]+)\./i, ', this figure was $1.')
    .replace(/, who is ([^.]+)\./i, ', this figure is $1.')
    .replace(/\bwhat does ([^.]+) represent\./i, '$1 represents this.');
}

function improveAliases(answer, aliases) {
  const values = new Set((aliases ?? []).filter(Boolean));
  const trimmed = answer.trim();
  values.add(trimmed);

  const withoutArticle = trimmed.replace(/^(the|a|an)\s+/i, '').trim();
  if (withoutArticle && withoutArticle !== trimmed) values.add(withoutArticle);

  if (trimmed.includes('&')) values.add(trimmed.replace(/&/g, 'and'));
  if (trimmed.toLowerCase().startsWith('st. ')) values.add(trimmed.replace(/^st\.\s+/i, 'Saint '));
  if (trimmed.toLowerCase().startsWith('saint ')) values.add(trimmed.replace(/^saint\s+/i, 'St. '));

  return [...values];
}

function scoreQuestion(row) {
  const clue = row.clue.trim();
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
