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
const targetIds = audit.flagged
  .filter((row) => row.decision === 'rewrite')
  .map((row) => row.id);

const rows = await fetchQuestions(targetIds);
const updates = [];

for (const row of rows) {
  const nextClue = rewriteClue(row).replace(/\s+/g, ' ').trim();
  const nextTags = normalizeTags(row.tags);
  const body = {
    clue: nextClue,
    tags: nextTags,
    quality_status: 'keep',
    quality_score: null,
    quality_issues: [],
  };

  if (row.answer === 'The Letter A') {
    body.answer = 'A';
    body.aliases = unique([...(row.aliases ?? []), 'The Letter A']);
  }

  updates.push({ id: row.id, previous_clue: row.clue, next_clue: nextClue, body });
}

for (const update of updates) {
  await patchQuestion(update.id, update.body);
}

const outputPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `quality-rewrite-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(outputPath, JSON.stringify({ count: updates.length, updates }, null, 2));
console.log(`Rewrote ${updates.length} questions.`);
console.log(`Report: ${outputPath}`);

function rewriteClue(row) {
  let clue = fixEncoding(row.clue.trim()).replace(/\?+$/, '.');
  const category = categoryFrame(row.category_id);

  const direct = [
    [/^The Watergate Scandal occured in what year\.$/i, 'The Watergate scandal began with a 1972 break-in and unfolded in this year.'],
    [/^The Watergate Scandal occurred in what year\.$/i, 'The Watergate scandal began with a 1972 break-in and unfolded in this year.'],
    [/^Gerald Ford became President in this year\.$/i, 'After Richard Nixon resigned, Gerald Ford became U.S. president in this year.'],
    [/^World War II ended in this year\.$/i, 'World War II ended with Allied victory in this year.'],
    [/^Canada was founded in this year\.$/i, 'The Dominion of Canada was formed by Confederation in this year.'],
    [/^The female blackbird is this color\.$/i, 'Unlike the black male blackbird, the female blackbird is usually this color.'],
    [/^This is Grumpy Cat's real name\.$/i, 'The internet-famous Grumpy Cat had this real name.'],
    [/^This is the collective noun for bears\.$/i, 'A group of bears can be called this collective noun.'],
    [/^This species is a "mountain chicken"\.$/i, 'Despite the name "mountain chicken," this Caribbean animal is this type of creature.'],
    [/^These are rhino's horn made of\.$/i, 'A rhinoceros horn is primarily made of this protein also found in hair and nails.'],
    [/^A Bonobo is this type of creature\.$/i, 'A bonobo is this type of great ape.'],
    [/^This is the national animal of India\.$/i, "India's national animal is this striped big cat."],
    [/^Wombats are native to this country\.$/i, 'Wombats are native to this country and nearby islands.'],
    [/^This is the national bird of Bahrain\.$/i, "Bahrain's national bird is this small songbird."],
    [/^This is the world's longest venomous snake\.$/i, "The world's longest venomous snake is this cobra species."],
    [/^This person proved Fermat's Last Theorem\.$/i, "Fermat's Last Theorem was finally proved in the 1990s by this mathematician."],
    [/^This many zeros are in a googol\.$/i, 'A googol is 1 followed by this many zeros.'],
    [/^This is the derivative of sin\(x\)\.$/i, 'In calculus, the derivative of sin(x) is this function.'],
    [/^This is when "Garry's Mod" was released\.$/i, '"Garry\'s Mod" was first released on this date.'],
    [/^This is the world's oldest board game\.$/i, "Often cited as the world's oldest board game, this game was played in ancient Egypt."],
    [/^This game was used to advertise Steam\.$/i, 'Valve used this tactical shooter to help advertise Steam.'],
    [/^Only 9% of US Households owned a television in$/i, 'Only about 9% of U.S. households owned a television in this year.'],
    [/^A milliner makes and sells this type of headwear\.$/i, 'A milliner makes and sells this type of headwear.'],
    [/^In past times, what would a gentleman keep in his fob pocket\.$/i, 'In past times, a gentleman might keep this timepiece in his fob pocket.'],
    [/^In which cardinal direction does the Sun rise from\.$/i, 'The Sun appears to rise from this cardinal direction.'],
    [/^By default, HTTP commonly runs on this numbered port\.$/i, 'By default, unencrypted HTTP commonly runs on this numbered network port.'],
    [/^If someone said "you are olid", they mean this\.$/i, 'The adjective "olid" means having this unpleasant smell.'],
    [/^A minotaur is half human half this animal\.$/i, 'In Greek myth, the Minotaur is half human and half this animal.'],
    [/^By definition, an abyssopelagic animal lives in this deep-ocean zone\.$/i, 'By definition, an abyssopelagic animal lives in this deep-ocean zone.'],
    [/^A spotted hyena would "laugh" for this reason\.$/i, 'A spotted hyena may make its famous laugh-like call when feeling this emotion.'],
    [/^In geometry, a pentagon has this many sides\.$/i, 'In geometry, a pentagon is a polygon with this many sides.'],
    [/^In geometry, a heptagon has this many sides\.$/i, 'In geometry, a heptagon is a polygon with this many sides.'],
    [/^This is the first Mersenne prime exponent over 1000\.$/i, 'The first Mersenne prime exponent greater than 1000 is this number.'],
    [/^In algebra, x\^2 \+ 2x \+ 1 is this type of function\.$/i, 'In algebra, x^2 + 2x + 1 is this type of polynomial function.'],
    [/^In poker, this two-letter abbreviation means expected value\.$/i, 'In poker strategy, this two-letter abbreviation stands for expected value.'],
  ];

  for (const [pattern, replacement] of direct) {
    if (pattern.test(clue)) return replacement;
  }

  clue = clue
    .replace(/^This artist painted the painting "([^"]+)"\.$/i, 'This artist painted "$1," a well-known American canvas.')
    .replace(/^This artist painted "([^"]+)"\.$/i, `${category}, this artist painted "$1."`)
    .replace(/^This artist painted ([^.]+)\.$/i, `${category}, this artist painted $1.`)
    .replace(/^This person designed the Chupa Chups logo\.$/i, 'This surrealist artist designed the Chupa Chups logo in 1969.')
    .replace(/^This artist sculpted the statue of David\.$/i, 'This Renaissance artist sculpted the marble statue of David.')
    .replace(/^These were Marcel Duchamp's readymades\.$/i, 'Marcel Duchamp called ordinary manufactured items presented as art by this term.')
    .replace(/^This person wrote the novel "([^"]+)"\.$/i, `${category}, this author wrote the novel "$1."`)
    .replace(/^This person wrote "([^"]+)"\.$/i, `${category}, this author wrote "$1."`)
    .replace(/^Stephen King's "IT" takes place here\.$/i, 'Stephen King\'s "IT" takes place in this fictional Maine town.')
    .replace(/^This is Ron Weasley's middle name\.$/i, "In the Harry Potter books, Ron Weasley's middle name is this.")
    .replace(/^This is Hermione Granger's middle name\.$/i, "In the Harry Potter books, Hermione Granger's middle name is this.")
    .replace(/^Harry Potter plays this position in Quidditch\.$/i, 'On the Gryffindor Quidditch team, Harry Potter plays this position.')
    .replace(/^The Lumineers released this album in 2016\.$/i, 'The Lumineers released this album, named for a historical queen, in 2016.')
    .replace(/^Bon Iver released this album in 2016\.$/i, 'Bon Iver released this symbol-heavy album in 2016.')
    .replace(/^Daft Punk released this many studio albums\.$/i, 'French electronic duo Daft Punk released this many studio albums.')
    .replace(/^This is the Swedish word for "([^"]+)"\.$/i, 'In Swedish, this word means "$1."')
    .replace(/^This is a "dakimakura"\.$/i, 'In Japanese pop culture, a dakimakura is this kind of pillow.')
    .replace(/^This many furlongs are in a mile\.$/i, 'A mile contains this many furlongs.')
    .replace(/^Trypophobia is the fear of this\.$/i, 'Trypophobia is an aversion to clusters of these.')
    .replace(/^Antibiotics are generally taken to combat this\.$/i, 'Antibiotics are generally used to combat this type of infection.')
    .replace(/^This organ of the body produces bile\.$/i, 'In human anatomy, this organ produces bile.')
    .replace(/^Astraphobia is the irrational fear of this\.$/i, 'Astraphobia is the irrational fear of thunder and this weather phenomenon.')
    .replace(/^This is real haggis made of\.$/i, 'Traditional haggis is made from these sheep organs.')
    .replace(/^This person invented the "Spanning Tree Protocol"\.$/i, 'The Spanning Tree Protocol was invented by this computer scientist.')
    .replace(/^These words are abbreviated "LCD"\.$/i, 'The display abbreviation LCD stands for these words.')
    .replace(/^These words are abbreviated CPU\.$/i, 'In computing, CPU stands for these words.')
    .replace(/^The Prt Sc button does this\.$/i, 'On a keyboard, the Prt Sc button performs this screen-capture action.')
    .replace(/^Hippomenes defeated this person in a footrace\.$/i, 'In Greek myth, Hippomenes defeated this swift heroine in a footrace.')
    .replace(/^Cerberus has this many heads\.$/i, 'In Greek myth, Cerberus is usually shown with this many heads.')
    .replace(/^This was the punishment for Sysiphus's craftiness\.$/i, "For his craftiness, Sisyphus was condemned to this eternal punishment.")
    .replace(/^Neptune's Greek name was this\.$/i, 'The Roman sea god Neptune corresponds to this Greek god.')
    .replace(/^Radiation is measured in this unit\.$/i, 'Absorbed radiation dose is measured in this SI unit.')
    .replace(/^The Aardwolf belongs to this scientific family\.$/i, 'The aardwolf belongs to this same mammal family as hyenas.')
    .replace(/^This character is from "Splatoon"\.$/i, 'In the Splatoon series, this idol character performs with Callie as the Squid Sisters.')
    .replace(/^In Overwatch, what is Lúcio's full name\.$/i, 'In Overwatch lore, Lúcio is known by this full name.')
    .replace(/^In "Last Supper" by Leonardo Da Vinci, what two colors were the robes worn by Jesus\.$/i, 'In Leonardo da Vinci\'s "Last Supper," Jesus wears robes of these two colors.')
    .replace(/^The painting "Guernica" by Pablo Picasso expressed emotions of dread in response to which war\.$/i, 'Picasso\'s "Guernica" responded to the bombing of a town during this war.')
    .replace(/^In Washington, D\.C\. what does the "C" stand for\.$/i, 'In Washington, D.C., the "C" stands for this.')
    .replace(/^The Pyrenees mountains are located on the border of which two countries\.$/i, 'The Pyrenees form a natural border between these two countries.')
    .replace(/^The land mass of modern day Turkey is called what\.$/i, 'The land mass of modern-day Turkey is known by this regional name.')
    .replace(/^According to the United States Constitution, how old must a person be to be elected President of the United States\.$/i, 'The U.S. Constitution sets this minimum age for being elected president.')
    .replace(/^The Second Boer War in 1899 was fought where\.$/i, 'The Second Boer War, beginning in 1899, was fought in this country.')
    .replace(/^Spain was formed in 1469 with the marriage of Isabella I of Castile and Ferdinand II of what other Iberian kingdom\.$/i, 'Spain was united by the 1469 marriage of Isabella of Castile and Ferdinand of this Iberian kingdom.')
    .replace(/^In 1845, a series of wars named after which indigenous people began in New Zealand\.$/i, 'In 1845, a series of New Zealand wars began that were named for this indigenous people.')
    .replace(/^In which war did the atomic bombings of Hiroshima and Nagasaki occur\.$/i, 'The atomic bombings of Hiroshima and Nagasaki occurred during this war.')
    .replace(/^Rearrange ([A-Z]+) to mean (.+)\.$/i, 'Anagram "$1" to get a word meaning $2.')
    .replace(/^Rearrange ([A-Z]+) into (.+)\.$/i, 'Anagram "$1" to get this phrase about $2.')
    .replace(/^Disney snowman \+ Newton unit of force\.$/i, 'Before & After: Disney snowman + the SI unit of force.')
    .replace(/^Poet’s before\.$/i, 'In poetry, this archaic word means "before."')
    .replace(/^In "The Lord of the Rings," who is the owner of Asfaloth, the horse which brings Frodo to Rivendell\.$/i, 'In "The Lord of the Rings," Asfaloth, the horse that brings Frodo to Rivendell, belongs to this Elf-lord.')
    .replace(/^In the Beatrix Potter books, what type of animal is Tommy Brock\.$/i, 'In Beatrix Potter\'s books, Tommy Brock is this type of animal.')
    .replace(/^In the "Harry Potter" novels, what must a Hogwarts student do to enter the Ravenclaw Common Room\.$/i, 'In the Harry Potter novels, a student must do this to enter the Ravenclaw common room.')
    .replace(/^According to The Hitchhiker's Guide to the Galaxy book, the answer to life, the universe and everything else is\.\.\.$/i, 'In "The Hitchhiker\'s Guide to the Galaxy," this number is the answer to life, the universe, and everything.')
    .replace(/^'I'm never gonna dance again, guilty feet have got no rhythm' were lyrics from which Wham! hit single\.$/i, 'The lyric "guilty feet have got no rhythm" comes from this Wham! hit single.')
    .replace(/^In which fast food chain can you order a Jamocha Shake\.$/i, 'The Jamocha Shake is a menu item at this fast-food chain.')
    .replace(/^According to Japanese folklore, what is the favorite food of the Kappa\.$/i, 'According to Japanese folklore, kappa are especially fond of this food.')
    .replace(/^According to the Egyptian Myth of Osiris, who murdered Osiris\.$/i, 'In the Egyptian myth of Osiris, Osiris is murdered by this god.')
    .replace(/^A mathematical constant, known as "The Golden Ratio", is most commonly represented by which greek letter\.$/i, 'The golden ratio is most commonly represented by this Greek letter.')
    .replace(/^In Yu-Gi-Oh, how does a player perform an Xyz Summon\.$/i, 'In Yu-Gi-Oh!, a player performs an Xyz Summon by doing this with monsters of the same level.')
    .replace(/^Europa Universalis is a strategy video game based on which French board game\.$/i, 'The strategy video game Europa Universalis was based on this French board game.')
    .replace(/^At the start of a standard game of the Monopoly, if you throw a double six, which square would you land on\.$/i, 'At the start of Monopoly, rolling double sixes lands you on this square.')
    .replace(/^Some of the "Fallen Empires" cards from "Magic: The Gathering" were misprinted on the backs of which other card game\.$/i, 'Some Magic: The Gathering "Fallen Empires" cards were misprinted with backs from this other card game.')
    .replace(/^This is the sum of all the tiles in a standard box of Scrabble\.$/i, 'The face values of all tiles in a standard Scrabble set add up to this number.')
    .replace(/^In "Magic: The Gathering", during the design for Planar Chaos, what color did the developers think of adding in as the sixth color\.$/i, 'During design for Magic: The Gathering\'s Planar Chaos, developers considered adding this sixth color.')
    .replace(/^In the Board Game, Settlers of Catan, a die roll of what number causes the Robber to attack\.$/i, 'In Settlers of Catan, a die roll of this number activates the robber.')
    .replace(/^On a standard Monopoly board, how much do you have to pay for Tennessee Ave\.$/i, 'On a standard Monopoly board, Tennessee Avenue costs this amount.')
    .replace(/^In a standard game of Monopoly, what colour are the two cheapest properties\.$/i, 'In standard Monopoly, the two cheapest properties are this color group.')
    .replace(/^In Magic: The Gathering, what card's flavor text is "Catch!"\.$/i, 'In Magic: The Gathering, the card with the flavor text "Catch!" is this red spell.')
    .replace(/^The protagonist in the game "Cave Story" is named$/i, 'The protagonist of the video game "Cave Story" has this name.')
    .replace(/^In Undertale, what's the prize for answering correctly\.$/i, 'In Undertale, the prize for answering correctly is this.')
    .replace(/^In the video game "League of Legends" which character is known as "The Sinister Blade"\.$/i, 'In League of Legends, "The Sinister Blade" is this champion.')
    .replace(/^In most FPS video games such as Counter-Strike, shooting which part of the body does the highest damage\.$/i, 'In many FPS games such as Counter-Strike, shots to this body part do the highest damage.');

  clue = clue
    .replace(/^This is the official language of (.+)\.$/i, `In world geography, this language is official in $1.`)
    .replace(/^This is the official language in (.+)\.$/i, `In world geography, this language is official in $1.`)
    .replace(/^This is (.+)'s second-largest city\.$/i, `In world geography, this city is $1's second-largest.`)
    .replace(/^This is the second-largest city in (.+)\.$/i, `In world geography, this city is the second-largest in $1.`)
    .replace(/^This is special about (.+)\.$/i, `In world geography, $1 is known for this distinction.`)
    .replace(/^This is the busiest port in (.+)\.$/i, `In world geography, this port is the busiest in $1.`)
    .replace(/^This nation claims ownership of Antarctica\.$/i, 'No sovereign nation has ownership of Antarctica; this is the answer to who owns it.')
    .replace(/^(.+) has this many states\.$/i, `${category}, $1 has this many states.`)
    .replace(/^(.+) has this many time zones\.$/i, `${category}, $1 officially uses this many time zones.`)
    .replace(/^This many (.+) are in (.+)\.$/i, `In measurement, $3 contains this many $1.`)
    .replace(/^(.+) has this many (.+)\.$/i, `${category}, $1 has this many $2.`)
    .replace(/^(.+) is measured in this unit\.$/i, `${category}, $1 is measured in this unit.`)
    .replace(/^(.+) is this color\.$/i, `${category}, $1 is this color.`)
    .replace(/^(.+) are native to this country\.$/i, `${category}, $1 are native to this country.`)
    .replace(/^(.+) belongs to this scientific family\.$/i, `${category}, $1 belongs to this scientific family.`)
    .replace(/^(.+) defeated this person in a footrace\.$/i, `${category}, $1 defeated this person in a footrace.`)
    .replace(/^(.+) has this many heads\.$/i, `${category}, $1 has this many heads.`)
    .replace(/^(.+)'s Greek name was this\.$/i, `${category}, $1's Greek counterpart has this name.`)
    .replace(/^(.+) released this album in ([0-9]{4})\.$/i, `${category}, $1 released this album in $2.`)
    .replace(/^(.+) released this many studio albums\.$/i, `${category}, $1 released this many studio albums.`)
    .replace(/^(.+) is from "([^"]+)"\.$/i, `${category}, $1 is a character from "$2."`);

  if (clue.split(/\s+/).length < 8) {
    return `${category}, ${lowercaseFirst(clue)}`;
  }

  return clue;
}

function categoryFrame(categoryId) {
  return {
    arts_visual_culture: 'In art history',
    geography: 'In geography',
    history: 'In history',
    language_wordplay: 'In wordplay',
    literature_books: 'In literature',
    music_performing_arts: 'In music',
    pop_culture_media_modern_life: 'In modern life',
    religion_mythology_philosophy: 'In mythology and religion',
    science: 'In science',
    sports_games_leisure: 'In games and sports',
  }[categoryId] ?? 'In trivia';
}

function normalizeTags(tags = []) {
  return unique(tags.filter((tag) => !['multiple', 'boolean'].includes(tag)).concat('free-response', 'quality-rewritten'));
}

function fixEncoding(value) {
  return value
    .replaceAll('MÃ¶bius', 'Möbius')
    .replaceAll('NiccolÃ²', 'Niccolò')
    .replaceAll('Â°C', '°C')
    .replaceAll('Â°F', '°F');
}

function lowercaseFirst(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function fetchQuestions(ids) {
  const all = [];
  for (const chunk of chunks(ids, 80)) {
    const rows = await request(`/rest/v1/questions?select=*&id=in.(${chunk.join(',')})`);
    all.push(...rows);
  }
  return all;
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
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
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
