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

const rewrites = [
  ['ed9610c6-e9dc-4f26-92f8-4a464e16621e', { clue: 'Greek skhole, meaning leisure, eventually gave English this word for an educational institution.', value: 400 }],
  ['96a65219-faf7-4d4c-91c5-83e98d430937', { clue: 'Italian roots meaning bad star gave English this word for a catastrophe.', value: 400 }],
  ['fd709754-5e08-4f70-9df9-044b431939a9', { clue: 'Latin salarium, linked with salt money, gives English this word for regular pay.', value: 400 }],
  ['4cdc16fa-484c-49f8-af1a-1db7f2856bb4', { clue: 'This French board game inspired a Paradox grand strategy video game of the same name.', value: 600 }],
  ['2ce96771-9d6c-41e9-a78e-1d5cafc25df7', { clue: 'This capital of Japan sits on a bay at the mouth of the Sumida River.', value: 200 }],
  ['781d0ade-77be-431a-a088-e201b1c27c68', { clue: 'This capital of Kenya lies near the Athi Plains and is served by Jomo Kenyatta International Airport.', value: 400 }],
  ['773ca081-502c-487b-922d-af90addc427d', { clue: 'This former Khmer capital in Cambodia is now a vast temple complex and UNESCO site.', value: 600 }],
  ['eed7da36-0d93-47db-87e5-6a7296ff6490', { clue: 'John Quincy Adams won the presidency after this disputed election was decided by the House.', value: 600 }],
  ['391fa32a-3b87-4769-944b-9c5460f94ab1', { clue: 'This Fitzgerald novel follows Nick Carraway into the parties of a mysterious Long Island millionaire.', value: 400 }],
  ['3b8af34e-b07a-42ad-ae33-a791c8bb8912', { clue: 'Lin-Manuel Miranda created this musical about an immigrant founding father.', value: 200 }],
  ['e7056b6b-a362-4aef-bdac-dbbb57e5b5ca', { clue: 'This Sondheim musical mixes Cinderella, Jack, Rapunzel, and other fairy-tale figures.', value: 600 }],
  ['305efd92-a8e5-46d5-bc3e-0552ee0b97e1', { clue: 'Astraphobia is the irrational fear of lightning and this rumbling weather phenomenon.', value: 200 }],
  ['5e3056bd-84d7-4b94-a12e-6ad57211e457', { clue: 'This Marvel hero gained powers after being bitten by a radioactive arachnid.', value: 200 }],
  ['1a5bbdea-a13a-4160-a153-b4547156deb2', { clue: 'Blue jeans are commonly made from this sturdy cotton twill fabric.', value: 200 }],
  ['56de2194-52c5-4f5a-8481-4245c27d0cae', { clue: 'This short New Testament letter asks a slave owner to receive Onesimus as a brother.', value: 800 }],
  ['ecc433a1-c000-4691-ae41-3a4a94962d92', { clue: "This Jewish prayer begins with a Hebrew command to hear and declares God's oneness.", value: 600 }],
  ['75ce66d3-df14-4eb7-906b-beb0699b62ae', { clue: 'Named for an English physicist, this SI unit measures force.', value: 400 }],
  ['f7f3da08-0d06-4cbd-aa02-4931905d25b4', { clue: 'This earthquake-magnitude scale is named for a California seismologist.', value: 400 }],
  ['0fe23131-8404-468c-a957-fdaee47a1edb', { clue: 'A domestic rabbit has an average lifespan of this many years.', answer: '8 to 12 years', aliases: ['8-12 years', '8 to 12 years', 'eight to twelve years'], value: 400 }],
  ['4c8047d3-0cee-4cc6-b2ca-967482e25f67', { clue: 'Combined, all cutscenes from Metal Gear Solid 4 are about this many hours long.', answer: '8 hours', aliases: ['8 hours', 'eight hours'], value: 800 }],
  ['7525d899-6856-4385-a181-b49926b4eac2', { clue: 'This translucent ceramic, prized in Europe after imports from China, is used for fine tableware.', value: 400 }],
  ['a37aea89-e638-4a2b-9fc4-a314db117d85', { clue: 'In the European Union license system, motorcycles generally require this lettered license classification.', aliases: ['A', 'category A', 'Category A'], value: 800 }],
  ['94ca725c-a50b-420d-a265-f5d81738831b', { clue: 'This homophone of knight names the opposite of day.', value: 200 }],
  ['8f3d1dfc-769e-42c0-a15f-6a57b4afec46', { clue: 'In publishing and library catalogs, this two-letter abbreviation means manuscript.', value: 600 }],
  ['185f798e-9c2a-4044-8541-19a9b33a8fd6', { clue: 'In baseball, this three-letter statistic credits a batter for driving runners home.', aliases: ['R.B.I.', 'runs batted in'], value: 400 }],
  ['467d5492-8086-4c98-bef5-96c48bd19d38', { clue: 'In this idiom, revealing a secret lets the cat escape from this container.', value: 200 }],
  ['bd9ad750-e5f8-4e2f-80cf-fa2d32edd368', { clue: 'In this idiom, making a problem worse adds fuel to this.', value: 200 }],
  ['c7230978-c986-4086-933d-5ec7bb012ab5', { clue: "In this idiom, a final tolerated problem is the straw that breaks this animal's back.", answer: 'Camel', aliases: ['camel', "camel's back", 'camel back'], value: 400 }],
  ['89173c72-2a2e-483a-8f4c-1987d5a3e0ab', { clue: 'In this idiom, an obvious unspoken problem is the elephant standing in this place.', value: 200 }],
  ['f6bb952d-5ea6-4215-a513-3f0dbeb54339', { clue: 'Charles and Ray Eames created this molded-plywood-and-leather seat, a midcentury design icon.', value: 600 }],
  ['5ea31f99-ae4b-4610-a690-781c456cd7c1', { clue: 'The adjective olid describes something with this disagreeable sensory quality.', answer: 'An unpleasant smell', aliases: ['unpleasant smell', 'foul smell', 'bad smell', 'stink'], value: 800 }],
  ['c0e38f64-e1f2-4490-a7e7-f8cf340b2399', { clue: 'In Yu-Gi-Oh!, an Xyz Summon uses monsters of the same level by placing them this way.', answer: 'Overlaying them', aliases: ['overlay', 'overlaying', 'overlaying monsters'], value: 800 }],
  ['af339a2e-c446-4dd0-82e6-295d391abd25', { clue: 'Musicians commonly write cut time with this time signature.', value: 400 }],
  ['f2fc110a-3aeb-45a4-be1a-5be5c89c3dde', { clue: 'One World Trade Center in New York City reaches this height in feet.', aliases: ['1,776 ft', '1776 feet', '1,776 feet'], value: 400 }],
  ['e863ecda-0f4a-4e37-b586-af1f9a9e5200', { clue: 'Rock songs most often use this time signature.', value: 400 }],
  ['f042dfb2-ce9f-4b54-a8c5-b2be476c4f43', { clue: 'In Monty Python and the Holy Grail, the joking airspeed of an unladen European swallow is this many miles per hour.', aliases: ['24 MPH', '24 mph', 'twenty-four miles per hour'], value: 600 }],
  ['0972e8e4-391f-4849-a327-c243a8ecc35b', { clue: 'Compact Disc Digital Audio uses this standard sampling frequency in kilohertz.', aliases: ['44.1 kHz', '44.1 kilohertz'], value: 600 }],
  ['503abe5a-9d23-4e5c-a057-5c721f452da9', { clue: 'The mathematical constant e is approximately this value to two decimal places.', value: 600 }],
  ['d3fd3801-bbd3-4b48-a8f7-9f4fbe3cea9c', { clue: "Counting the top 1 as row zero, row 4 of Pascal's Triangle has these five numbers.", value: 600 }],
  ['9f6839cb-ec05-4d1a-898b-47ac034fcdca', { clue: 'On a standard Monopoly board, Tennessee Avenue has this purchase price.', aliases: ['$180', '180 dollars', '180'], value: 600 }],
  ['a8d86176-73a7-494b-8654-88627f16f420', { clue: 'This Botticelli painting shows a nude goddess arriving on a shell.', value: 400 }],
  ['3afd63d6-ae00-43d7-9650-dea2c390a24a', { clue: 'This Seurat painting places leisure seekers beside the Seine in pointillist dots.', value: 600 }],
  ['d0c51df5-be9b-4f9d-ab71-d2b4e16ee2bb', { clue: 'This iron Paris landmark was built for the 1889 Exposition Universelle.', value: 200 }],
  ['0d10eb93-f657-4f7e-8e39-c63c9cab5701', { clue: 'This Maya Lin-designed Washington memorial lists the names of U.S. service members on polished black granite.', value: 400 }],
  ['7f0c8a12-a6d6-4eb6-be24-ab25832cc83c', { clue: 'This Art Deco statue overlooks Rio de Janeiro from Mount Corcovado.', value: 400 }],
  ['33daeb9a-89fd-42d0-84b0-910f03ece14f', { clue: 'This American collector built a major modern art collection and opened Art of This Century in New York.', value: 800 }],
  ['81b64248-4f80-4be6-907b-32af05fb59dd', { clue: 'This domed Washington monument honors the main author of the Declaration of Independence.', value: 600 }],
  ['ea9b603b-17a0-41aa-8bd6-b8117c1afed6', { clue: 'This Texas city is known as the Rose Capital of the World.', value: 800 }],
  ['f59d809b-154d-4f41-9368-50e461ac6bc7', { clue: 'This vast desert in Mongolia and China is known for harsh temperatures.', value: 600 }],
  ['68fa7ffd-6f7b-4173-9dcd-337000924b72', { clue: 'This South American drainage region spans parts of Brazil, Peru, and other countries.', value: 600 }],
  ['36104073-5eb6-4c7c-a872-1fd24934b086', { clue: "Santa's legendary home is this geographic point at 90 degrees N.", value: 400 }],
  ['6bc7b6c2-bbaf-4d17-8588-ed4b3e2fcff7', { clue: 'This 1773 colonial protest dumped tea into a Massachusetts harbor.', value: 200 }],
  ['5dfc91e8-2bd0-411a-8224-ee0777fe29ce', { clue: 'This 1890 massacre of Lakota people took place near a South Dakota creek.', value: 800 }],
  ['89a8b2d1-2629-4446-8c9c-a472d3115a38', { clue: 'This 1945 Crimea meeting brought together Roosevelt, Churchill, and Stalin.', value: 600 }],
  ['22338522-0092-4fd1-9dcf-a2c6a82a0876', { clue: 'This 1803 land acquisition from France doubled the size of the United States.', value: 200 }],
  ['b7910cff-3989-4669-8dd0-3334f6f540b1', { clue: "This 1917 Bolshevik uprising brought Lenin's party to power in Russia.", value: 600 }],
  ['4544d739-3902-4546-a8b3-bd86010c1d6b', { clue: 'This Chinese dynasty built early Great Wall sections and standardized writing.', value: 400 }],
  ['4ec05224-de8f-4492-8b7b-6351dc5a6d18', { clue: 'This grammar error makes a descriptive phrase attach to the wrong word in a sentence.', value: 600 }],
  ['e46f86dd-b0c0-44f3-8a16-9801c8874cb9', { clue: "Stephen King's It takes place in this fictional Maine town.", value: 400 }],
  ['c191fb3a-9ecf-4319-9a99-f78a087cff76', { clue: "This Roald Dahl book sends a poor boy into Willy Wonka's factory.", value: 200 }],
  ['939a6e0d-0a14-42c2-946c-dd49fc6a5a05', { clue: 'In this Mark Twain novel, two look-alike boys trade clothes and social roles.', value: 600 }],
  ['cc0fd655-72a6-4caa-adea-7ca611e897bf', { clue: 'This Arthur Miller play follows Willy Loman as his career and family life collapse.', value: 400 }],
  ['5a597d06-663b-48c1-97ee-0c6d6a25ab0f', { clue: 'This C. S. Lewis novel sends four children through furniture into Narnia.', value: 400 }],
  ['2c5dec8e-9991-4419-ac6a-a48a950394b9', { clue: 'This annual literary award category honors a distinguished American novel or story collection.', value: 400 }],
  ['6ca1c881-0267-4734-8843-8321d4732ea5', { clue: "This Buggles song launched MTV's broadcast day on August 1, 1981.", value: 400 }],
  ['f87f97c5-6f83-48fe-8257-45ec41c25724', { clue: 'Traditional haggis uses this trio of sheep organs.', answer: 'Heart, liver, and lungs', aliases: ['heart liver and lungs', "sheep's heart liver and lungs"], value: 400 }],
  ['5e09dd2f-9905-4463-a5f3-9d60fcf2c7bc', { clue: "Pepsi was originally introduced under this name honoring its inventor's surname.", value: 400 }],
  ['c69fbb58-3da1-4633-8f0c-7e4651fa3e33', { clue: 'On a keyboard, the Prt Sc button performs this action.', answer: 'Takes a screenshot', aliases: ['takes a screenshot', 'captures the screen', 'copies the screen to the clipboard'], value: 200 }],
  ['c67a8686-4263-45cb-839b-5bba4f108d06', { clue: 'The display abbreviation LCD expands to these three words.', value: 400 }],
  ['17808066-866f-4b3b-8764-7a696da39785', { clue: 'This global health agency uses the abbreviation WHO.', value: 200 }],
  ['62163841-4ecd-435f-800d-71f55d2dd94d', { clue: 'This climate accord is named for the French capital where it was adopted in 2015.', value: 400 }],
  ['0b1679cf-c619-4a41-8ba6-920887d4aad5', { clue: 'This space telescope released its first full-color images in 2022.', value: 400 }],
  ['c30ac00c-aa61-4605-83c1-02c726162a84', { clue: 'In Japanese pop culture, a dakimakura is this type of pillow.', value: 400 }],
  ['f5118f47-23d6-4a86-b9d6-685349159acf', { clue: "Moore's law originally predicted the transistor count on integrated circuits would double after this many years.", answer: 'Two', aliases: ['2', 'two', '2 years', 'two years', '24 months'], value: 400 }],
  ['65d6be8c-0567-42a4-be44-018318e2e2aa', { clue: "The world's longest venomous snake is this species of cobra.", value: 400 }],
  ['26bc7421-2ff7-44b8-b0a5-cae7aed5ac0f', { clue: 'This branch of abstract algebra studies polynomial equations through groups of symmetries.', value: 1000 }],
  ['d66f7ea1-5aff-4dd2-b46f-ba87f3f5853a', { clue: 'This 1990 space telescope has produced famous deep-field images.', value: 400 }],
  ['6093879b-f048-471c-9721-c4f5ad42dfea', { clue: 'This distant cloud of icy bodies is thought to surround the Solar System far beyond Pluto.', value: 600 }],
  ['047a3546-d938-46a3-9087-ab72f54e1de0', { clue: 'In Danganronpa: Trigger Happy Havoc, Aoi Asahina has this talent.', answer: 'Swimmer', aliases: ['swimmer', 'Ultimate Swimmer'], value: 800 }],
  ['3acb4389-db5b-4dfc-ac81-e9d8f64f99f8', { clue: 'This Brazilian DJ and support hero in Overwatch has the surname Correia dos Santos.', answer: 'Lucio', aliases: ['Lucio', 'Lucio Correia dos Santos'], value: 600 }],
  ['a8c8d3a5-62b9-42c1-864e-4dc3f24eddb6', { clue: 'In basketball, this hyphenated shot is taken from behind the arc.', value: 200 }],
  ['8cdf01ef-2c49-415a-954e-044699e33d1e', { clue: 'This situation in baseball has three balls and two strikes.', value: 200 }],
  ['82236fa5-895e-48a5-9e64-bc5fde56c72f', { clue: 'This college football trophy goes annually to the most outstanding player.', value: 400 }],
  ['9eba4ad5-d2ec-4830-8070-c8bf3bce86a1', { clue: "Ariadne's thread gave English this word meaning a hint.", value: 600 }],
  ['66a72d57-e6eb-4515-afef-c1ae5a26e35e', { clue: 'Named for a Titan forced to hold the sky, this word means a book of maps.', value: 600 }],
  ['6dbce510-5f9e-41e2-ad26-1d74cd2bc5ea', { clue: 'Latin scrupulus, a small sharp stone, gave English this word for a tiny amount.', value: 800 }],
  ['fe34f32a-0275-4208-8cf9-717f235b42ab', { clue: 'As she can refer to Maria, this part of speech stands in for a noun.', value: 400 }],
  ['db5c54c6-d57f-485f-9b07-324cc69c3769', { clue: 'This word means deliberately ambiguous or evasive, especially in language.', value: 800 }],
  ['050c1eea-63cb-418f-9e8b-95419596a668', { clue: 'Greek roots meaning false name give English this term for an assumed author name.', value: 800 }],
  ['350d8af1-8dec-49b7-acef-e5d178a0b85f', { clue: 'Greek roots meaning true sense give English this term for the study of word origins.', value: 600 }],
];

const updates = [];

for (const [id, fix] of rewrites) {
  const existing = await request(`/rest/v1/questions?select=*&id=eq.${id}&limit=1`);
  if (!existing.length) throw new Error(`Question not found: ${id}`);
  const previous = existing[0];
  const next = {
    ...previous,
    ...fix,
    difficulty_rank: valueToRank(fix.value ?? previous.value),
  };
  const quality = auditQuestion(next);
  const body = {
    ...pickDefined({
      clue: fix.clue,
      answer: fix.answer,
      aliases: fix.aliases,
      value: fix.value,
      difficulty_rank: valueToRank(fix.value ?? previous.value),
    }),
    quality_status: quality.decision,
    quality_score: quality.score,
    quality_issues: quality.issues,
  };

  await request(`/rest/v1/questions?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { Prefer: 'return=minimal' },
  });

  updates.push({
    id,
    previous: {
      clue: previous.clue,
      answer: previous.answer,
      aliases: previous.aliases,
      value: previous.value,
      difficulty_rank: previous.difficulty_rank,
    },
    next: body,
  });
}

const reportPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `rewrite-and-difficulty-pass-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(reportPath, JSON.stringify({ count: updates.length, updates }, null, 2));

console.log(`Applied ${updates.length} rewrites / targeted difficulty updates.`);
console.log(`Report: ${reportPath}`);

function pickDefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

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
