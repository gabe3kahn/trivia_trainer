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

const audit = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'acquisition', 'question-quality-audit.json'), 'utf8'));
const ids = audit.flagged.map((row) => row.id);
const rows = await fetchQuestions(ids);
const updates = [];

const manual = {
  '11c87d7a-6f24-44d1-9ba1-967166342771': {
    clue: 'Add this two-letter suffix to "act" or "sail" to form a word meaning one who does that action.',
    answer: 'Or',
    aliases: ['-or', 'or'],
  },
  'a8f2cfc0-86db-4992-8ccc-6cac2fd33999': {
    clue: 'This political term means concentrating power and authority in one central organization.',
    answer: 'Centralism',
    aliases: ['centralism'],
  },
  '30ef55fc-9bfb-487d-96e0-52d7e2d774a6': {
    clue: 'On hospital signs, these two letters mark the department that handles acute emergencies.',
  },
  '024da462-fbcc-4143-acb9-629fe82d91ea': {
    clue: "Bahrain's national bird is this small songbird, a name also used for several passerine species.",
  },
  '0072091c-d999-4385-b234-65245a0b64c1': {
    clue: 'This grammar term names an -ing verb form used as a noun, as in "Swimming is fun."',
  },
  '02c3dfda-b622-45cd-a4c9-1abecd08a7d2': {
    clue: 'A milliner makes and sells these items of headwear, from fascinators to fedoras.',
  },
  '43b62070-0c9c-4c34-99dd-c2d6c147d64c': {
    clue: 'A gentleman might once have kept this timepiece in his vest or fob pocket.',
  },
  '08496d41-afd1-4588-8da9-6c0d9d71cb70': {
    clue: 'In human anatomy, this organ produces bile and helps process nutrients and toxins.',
  },
  '1044d0a1-caf7-4219-8fe4-b8f4afd59f3c': {
    clue: 'Unencrypted HTTP commonly runs on this default TCP port number.',
  },
  '791b1734-4d43-44b9-82ae-09b45ad9b21a': {
    clue: 'A mile is equal to this many furlongs in customary measurement.',
  },
  'a6ad83d3-160f-47fe-9539-a99164dc2723': {
    clue: 'Rhinoceros horns are primarily made of this protein, also found in hair and nails.',
  },
  '9bd2c0b7-6869-4661-b113-deedc519757f': {
    clue: 'A bonobo is classified as this kind of primate, along with gorillas and chimpanzees.',
  },
  '00f1a98d-5e3a-462a-8bf5-cbde891176c6': {
    clue: 'A spotted hyena may make its famous laugh-like call when experiencing this emotion.',
  },
  '5260189a-183f-449b-9cc4-fa92976d3b62': {
    clue: 'By definition, an abyssopelagic animal lives in this deep ocean zone near the seafloor.',
  },
  'a1e8360d-5512-4d3d-9b02-e9b29afc2aa0': {
    clue: 'Because its highest exponent is 2, x^2 + 2x + 1 is this type of polynomial function.',
  },
  '28dd7e56-aa67-4abd-b177-4824791552a4': {
    clue: 'A googol is written as 1 followed by this many zeroes.',
  },
  '6d9eddaa-20bc-43c3-8812-947dd5a04725': {
    clue: 'A heptagon is a polygon with this many sides.',
  },
  '7c315d85-7151-47ed-b304-c356fae183db': {
    clue: 'A pentagon is a polygon with this many sides.',
  },
  '1be908d0-f041-446f-a6e3-ddb6a0487f26': {
    clue: 'In calculus, differentiating sin(x) gives this trigonometric function.',
  },
  'a787224b-5350-4b5e-bf1b-933761eed3a0': {
    clue: 'The original Super Smash Bros. roster for Nintendo 64 included this many unlockable characters.',
  },
  '781f4bd0-80c8-46bc-b97b-a6ab4f13535b': {
    clue: 'In poker strategy, EV is the two-letter abbreviation for this statistical concept.',
  },
  '595b520b-3955-46f8-a082-ded2a2ad4740': {
    clue: 'On PlayStation 4, Minecraft has this many obtainable trophies including expansions.',
  },
  '617908f7-1844-44ef-a45f-a2ccfb575cc4': {
    clue: 'In Magic: The Gathering, this instant card has the highest converted mana cost.',
  },
  '4eaa8819-164b-42ea-a195-77fcb0693ffa': {
    clue: 'In The Legend of Zelda: Ocarina of Time, Link can carry this maximum number of rupees.',
  },
  '95860adc-1930-481e-bba1-d64ed06939ca': {
    clue: 'A standard chess game begins with this many pieces on the board.',
  },
  '3a753263-bac8-46c6-97ad-8d86e6020a27': {
    clue: 'In Mario Kart and Super Smash Bros., Princess Rosalina is generally considered this weight class.',
  },
  '850f9d67-27dc-46c8-9508-1d2eb307f6d5': {
    clue: 'This Spanish greeting means "hello."',
  },
};

for (const row of rows) {
  const body = {
    clue: manual[row.id]?.clue ?? polishGeneric(row.clue),
    answer: manual[row.id]?.answer ?? row.answer,
    aliases: unique([...(row.aliases ?? []), ...(manual[row.id]?.aliases ?? aliasHints(row))]),
    tags: unique((row.tags ?? []).filter((tag) => !['multiple', 'boolean'].includes(tag)).concat('free-response', 'quality-rewritten')),
    quality_status: 'keep',
    quality_score: null,
    quality_issues: [],
  };

  updates.push({ id: row.id, previous_clue: row.clue, next_clue: body.clue, body });
  await patchQuestion(row.id, body);
}

const outputPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `quality-polish-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(outputPath, JSON.stringify({ count: updates.length, updates }, null, 2));
console.log(`Polished ${updates.length} questions.`);
console.log(`Report: ${outputPath}`);

function polishGeneric(clue) {
  return clue
    .replace(/^This place is where the world's oldest still operational space launch facility located\.$/i, "The world's oldest still-operational space launch facility is located in this country.")
    .replace(/^This place was where the ancient city of Pompeii\.$/i, 'The ancient city of Pompeii was located in this modern country.')
    .replace(/^This city is the capital of the U\.S\. state Texas\.$/i, 'The capital of the U.S. state of Texas is this city.')
    .replace(/^In world geography, this city is Russia's second-largest\.$/i, "Russia's second-largest city is this former imperial capital.")
    .replace(/^This city is known as the Rose Capital of the World\.$/i, 'The city known as the Rose Capital of the World is this Texas city.')
    .replace(/^This city is the capital of the US state Nevada\.$/i, 'The capital of Nevada is this city, not Las Vegas.')
    .replace(/^In world geography, this city is the second-largest in Lithuania\.$/i, "Lithuania's second-largest city is this former temporary capital.")
    .replace(/^This city is the capital of South Korea\.$/i, "South Korea's capital is this city on the Han River.")
    .replace(/^This city is the capital of the United States of America\.$/i, 'The capital of the United States is this city.')
    .replace(/^This place is where the city of Haarlem located\.$/i, 'The city of Haarlem is located in this European country.')
    .replace(/^This city is the seat of government of the Netherlands\.$/i, 'The seat of government of the Netherlands is this city.')
    .replace(/^This letter do you need to have on a European driver license in order to ride any motorbikes\.$/i, 'A European driving license generally needs this letter category to ride motorcycles.')
    .replace(/^Between 1973 to 1990, this country was ruled by dictator Augusto Pinochet\.$/i, 'From 1973 to 1990, Augusto Pinochet ruled this South American country.')
    .replace(/^This person was the longest-serving senator in US history, serving from 1959 to 2010\.$/i, 'The longest-serving U.S. senator, serving from 1959 to 2010, was this West Virginian.')
    .replace(/^This person was the British Prime Minister at the outbreak of the Second World War\.$/i, 'Britain had this prime minister at the outbreak of World War II.')
    .replace(/^This person is the only US president to serve two non-consecutive terms in office\.$/i, 'The only U.S. president to serve two non-consecutive terms was this Democrat.')
    .replace(/^This person was South Africa's first Black President\.$/i, "South Africa's first Black president was this anti-apartheid leader.")
    .replace(/^This person was a military strategist in the Eastern Zhou period\.$/i, 'The Eastern Zhou military strategist credited with The Art of War was this figure.')
    .replace(/^This person was the first mammal successfully launched into Earth's orbit\.$/i, "The first mammal successfully launched into Earth's orbit was this Soviet dog.")
    .replace(/^This person was elected leader of the UK Labour Party in September 2015\.$/i, 'The UK Labour Party elected this politician as leader in September 2015.')
    .replace(/^This person is one of the co-princes of Andorra\.$/i, "One of Andorra's co-princes is the holder of this French office.")
    .replace(/^This person was the author of the 1954 novel, "Lord of the Flies"\.$/i, 'The 1954 novel Lord of the Flies was written by this British author.')
    .replace(/^This person is the author of the "A Song of Ice and Fire" book series, starting with "A Game of Thrones"\.$/i, 'A Song of Ice and Fire, beginning with A Game of Thrones, is by this author.')
    .replace(/^This person was the original author of Frankenstein\.$/i, 'The original author of Frankenstein was this English novelist.')
    .replace(/^In "The Hitchhiker's Guide to the Galaxy," this number is the answer to life, the universe, and everything\.$/i, 'In The Hitchhiker\'s Guide to the Galaxy, the answer to life, the universe, and everything is this number.')
    .replace(/^This person is the author of the series "Malazan Book of the Fallen"\.$/i, 'The Malazan Book of the Fallen series was written by this Canadian author.')
    .replace(/^This person was the lead singer and frontman of rock band R\.E\.M\.$/i, 'R.E.M. had this lead singer and frontman.')
    .replace(/^This city is the American singer "Pitbull" from\.$/i, 'The rapper Pitbull is from this Florida city.')
    .replace(/^This person is the Pink Floyd song "Shine On You Crazy Diamond" written about\.$/i, 'Pink Floyd wrote "Shine On You Crazy Diamond" about this former bandmate.')
    .replace(/^This person is the lead singer of Pearl Jam\.$/i, 'Pearl Jam has this lead singer.')
    .replace(/^This person is the musical artist who released the hit song, "Love Song," in 2007\.$/i, 'The 2007 hit "Love Song" was released by this singer-songwriter.')
    .replace(/^This country is singer Kyary Pamyu Pamyu from\.$/i, 'Singer Kyary Pamyu Pamyu is from this country.')
    .replace(/^This person is the lead singer of Foo Fighters\.$/i, 'Foo Fighters have this lead singer, formerly the drummer for Nirvana.')
    .replace(/^This place is where the train station "Llanfair­pwllgwyngyll­gogery­chwyrn­drobwll­llan­tysilio­gogo­goch"\.$/i, 'The famously long-named train station Llanfairpwllgwyngyll is in this country.')
    .replace(/^This person was the King of Gods in Ancient Greek mythology\.$/i, 'The king of the gods in ancient Greek mythology was this Olympian.')
    .replace(/^In Greek Mythology, this figure was the daughter of King Minos\.$/i, 'In Greek mythology, the daughter of King Minos who aided Theseus was this figure.')
    .replace(/^This person was the Roman god of fire\.$/i, 'The Roman god of fire and the forge was this deity.')
    .replace(/^This person is a minor god that is protector and creator of various arts, such as cheese making and bee keeping\.$/i, 'This minor Greek god protected rustic arts such as cheesemaking and beekeeping.')
    .replace(/^In most traditions, this figure was the wife of Zeus\.$/i, 'In most Greek traditions, the wife of Zeus was this goddess.')
    .replace(/^This person is the Egyptian god of reproduction and lettuce\.$/i, 'The Egyptian god associated with reproduction and lettuce was this deity.')
    .replace(/^This person is the god of war in Polynesian mythology\.$/i, 'The Polynesian god of war is this deity.')
    .replace(/^This person is the main antagonist of Ori and the Blind Forest\.$/i, 'The main antagonist of Ori and the Blind Forest is this owl.')
    .replace(/^This person was the first official world chess champion\.$/i, 'The first official world chess champion was this Austrian-American master.')
    .replace(/^This person is the villain company in "Stardew Valley"\.$/i, 'The villainous company in Stardew Valley is this corporation.');
}

function aliasHints(row) {
  const hints = {
    'd4feb8ee-ae4d-432c-8ab3-15fdcac5c88f': ['George Bush', 'Bush'],
    '980ef58e-e94f-4aa4-845b-5a9fe6c3f16a': ['Romeo & Juliet'],
    '8866ffc6-129b-4ad5-b626-3b09c2fde438': ["Frankenstein's monster", 'the monster', 'the creature'],
    '11f03fe7-e733-4c78-abc3-34e626810a9e': ['Shine On'],
  };
  return hints[row.id] ?? [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function fetchQuestions(ids) {
  const rows = [];
  for (const chunk of chunks(ids, 80)) {
    rows.push(...await request(`/rest/v1/questions?select=*&id=in.(${chunk.join(',')})`));
  }
  return rows;
}

async function patchQuestion(id, body) {
  await request(`/rest/v1/questions?id=eq.${id}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${supabaseUrl}${endpoint}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${endpoint} failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
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
