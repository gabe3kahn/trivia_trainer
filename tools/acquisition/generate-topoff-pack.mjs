import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const outputDir = path.join(rootDir, 'data', 'acquisition', 'normalized');
const label = process.argv[2] ?? 'topoff-001';

const difficultyRank = {
  200: 1,
  400: 2,
  600: 3,
  800: 4,
  1000: 5,
};

async function main() {
  const questions = parseRows(rows).map((row) => {
    const external_id = crypto
      .createHash('sha1')
      .update(`original_topoff_pack|${row.category_id}|${row.subcategory_name}|${row.clue}|${row.answer}`)
      .digest('hex')
      .slice(0, 16);

    return {
      source: 'original_topoff_pack',
      source_url: null,
      source_license: 'original',
      external_id: `topoff-${external_id}`,
      category_id: row.category_id,
      subcategory_name: row.subcategory_name,
      value: row.value,
      difficulty_rank: difficultyRank[row.value],
      mechanic: row.mechanic,
      constraint_text: row.constraint_text,
      clue: row.clue,
      answer: row.answer,
      aliases: row.aliases,
      distractors: [],
      tags: [...new Set(['topoff-pack', ...row.tags])],
      review_status: 'ready',
    };
  });

  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${label}.json`);
  await fs.writeFile(outputPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    provider: 'original_topoff_pack',
    notes: [
      'Original Jeopardy-style topoff pack to bring the active bank back to 1000 questions.',
      'Counts are matched to the 2026-05-31 live category deficits after the quality cleanup.',
    ],
    questions,
  }, null, 2));

  console.log(`Wrote ${outputPath}`);
  console.log(`Generated ${questions.length} questions.`);
  console.log(JSON.stringify(countByCategory(questions), null, 2));
}

function parseRows(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split('|');
      if (parts.length !== 7) throw new Error(`Line ${index + 1} has ${parts.length} columns.`);
      const [category_id, subcategory_name, valueText, clue, answer, aliasesText, tagsText] = parts.map((part) => part.trim());
      return {
        category_id,
        subcategory_name,
        value: Number(valueText),
        mechanic: 'standard',
        constraint_text: null,
        clue,
        answer,
        aliases: aliasesText ? aliasesText.split(';').map((item) => item.trim()).filter(Boolean) : [],
        tags: tagsText ? tagsText.split(';').map((item) => item.trim()).filter(Boolean) : [],
      };
    });
}

function countByCategory(items) {
  return items.reduce((acc, item) => {
    acc[item.category_id] = (acc[item.category_id] ?? 0) + 1;
    return acc;
  }, {});
}

const rows = String.raw`
literature_books|Authors & Works|200|This English author created Hercule Poirot and Miss Marple.|Agatha Christie|Christie|authors
literature_books|Authors & Works|400|This French author wrote Les Miserables and The Hunchback of Notre-Dame.|Victor Hugo|Hugo|authors
literature_books|Authors & Works|600|This Russian author wrote War and Peace and Anna Karenina.|Leo Tolstoy|Tolstoy|authors
literature_books|Authors & Works|800|This Colombian author wrote One Hundred Years of Solitude.|Gabriel Garcia Marquez|Garcia Marquez|authors
literature_books|Authors & Works|1000|This Italian poet guides readers through Hell, Purgatory, and Paradise in the Divine Comedy.|Dante Alighieri|Dante|authors
literature_books|19th-Century Novels|200|This Dickens novel begins with the line about the best of times and the worst of times.|A Tale of Two Cities|Tale of Two Cities|19th-century
literature_books|19th-Century Novels|400|This Bronte novel features the brooding Mr. Rochester and Thornfield Hall.|Jane Eyre||19th-century
literature_books|19th-Century Novels|600|This Melville novel sends Ishmael aboard the Pequod in pursuit of a white whale.|Moby-Dick|Moby Dick|19th-century
literature_books|19th-Century Novels|800|This Eliot novel centers on Dorothea Brooke and the town of its title.|Middlemarch||19th-century
literature_books|Shakespeare & Drama|200|This Shakespeare tragedy features the balcony scene and feuding families in Verona.|Romeo and Juliet||shakespeare
literature_books|Shakespeare & Drama|400|This Shakespeare comedy sends Viola disguised as Cesario into Illyria.|Twelfth Night||shakespeare
literature_books|Shakespeare & Drama|600|This Arthur Miller play follows Willy Loman near the end of his salesman life.|Death of a Salesman||drama
literature_books|Poetry|200|This American poet wrote Because I could not stop for Death.|Emily Dickinson|Dickinson|poetry
literature_books|Poetry|400|This Greek epic poem tells of Odysseus returning home to Ithaca.|The Odyssey|Odyssey|poetry
literature_books|Poetry|600|This poet wrote The Waste Land and The Love Song of J. Alfred Prufrock.|T. S. Eliot|TS Eliot;Eliot|poetry
literature_books|Children's & Young Adult Literature|200|This Roald Dahl book sends a poor boy into Willy Wonka's factory.|Charlie and the Chocolate Factory||childrens
literature_books|Children's & Young Adult Literature|400|This C. S. Lewis novel begins with children entering Narnia through a wardrobe.|The Lion, the Witch and the Wardrobe|Lion Witch and Wardrobe|childrens
literature_books|Children's & Young Adult Literature|600|This Madeleine L'Engle novel sends Meg Murry through a tesseract.|A Wrinkle in Time||young-adult
literature_books|American Literature|200|This Mark Twain novel follows a boy rafting down the Mississippi with Jim.|Adventures of Huckleberry Finn|Huckleberry Finn|american-literature
literature_books|American Literature|400|This Harper Lee novel is narrated by Scout Finch in Maycomb, Alabama.|To Kill a Mockingbird||american-literature
literature_books|American Literature|600|This Fitzgerald novel features Jay Gatsby's parties on Long Island.|The Great Gatsby|Great Gatsby|american-literature
literature_books|British & Irish Literature|200|This George Orwell novel features Big Brother and the slogan War is Peace.|Nineteen Eighty-Four|1984;Nineteen Eighty Four|british-literature
literature_books|British & Irish Literature|400|This Irish author created Leopold Bloom in Ulysses.|James Joyce|Joyce|irish-literature
literature_books|World Literature|400|This Cervantes novel follows a would-be knight and Sancho Panza.|Don Quixote||world-literature
literature_books|World Literature|600|This Japanese author wrote The Tale of Genji around the early 11th century.|Murasaki Shikibu|Lady Murasaki|world-literature
literature_books|Literary Characters|200|This detective at 221B Baker Street often works with Dr. Watson.|Sherlock Holmes|Holmes|characters
literature_books|Literary Characters|400|This Tolkien hobbit carries the One Ring toward Mount Doom.|Frodo Baggins|Frodo|characters
literature_books|Awards, Movements & Terms|400|This annual prize honors a distinguished work of American fiction.|Pulitzer Prize for Fiction|Pulitzer Prize|awards
history|U.S. Presidents & Elections|200|This first U.S. president warned against permanent foreign alliances in his farewell address.|George Washington|Washington|presidents
history|U.S. Presidents & Elections|400|This president served four elected terms and led the U.S. during most of World War II.|Franklin D. Roosevelt|FDR;Franklin Roosevelt|presidents
history|U.S. Presidents & Elections|600|This 1824 election was decided by the House after no candidate won an electoral majority.|Election of 1824|1824 election|elections
history|U.S. Presidents & Elections|800|This president signed the Pendleton Civil Service Reform Act after Garfield's assassination.|Chester A. Arthur|Arthur|presidents
history|U.S. History|200|This 1773 protest dumped tea into Boston Harbor.|Boston Tea Party||us-history
history|U.S. History|400|This 1803 purchase from France doubled the size of the United States.|Louisiana Purchase||us-history
history|U.S. History|600|This 1848 treaty ended the Mexican-American War and ceded California to the U.S.|Treaty of Guadalupe Hidalgo|Guadalupe Hidalgo|us-history
history|U.S. History|800|This 1890 massacre of Lakota people took place in South Dakota.|Wounded Knee Massacre|Wounded Knee|us-history
history|Ancient History|200|This Egyptian queen allied with Julius Caesar and Mark Antony.|Cleopatra|Cleopatra VII|ancient
history|Ancient History|400|This city was destroyed by Vesuvius in 79 CE.|Pompeii||ancient
history|Ancient History|600|This Carthaginian general crossed the Alps with elephants.|Hannibal|Hannibal Barca|ancient
history|Ancient History|800|This Persian king fought the Greeks at Thermopylae in 480 BCE.|Xerxes|Xerxes I|ancient
history|Medieval & Renaissance History|200|This Frankish king was crowned emperor in Rome on Christmas Day in 800.|Charlemagne|Charles the Great|medieval
history|Medieval & Renaissance History|400|This 1066 battle ended with William of Normandy defeating Harold Godwinson.|Battle of Hastings|Hastings|medieval
history|Medieval & Renaissance History|600|This Florentine family produced bankers, patrons, and rulers during the Renaissance.|Medici|Medici family|renaissance
history|Medieval & Renaissance History|800|This 1215 English charter limited King John's power.|Magna Carta||medieval
history|European History|200|This French prison was stormed on July 14, 1789.|Bastille|the Bastille|europe
history|European History|400|This Corsican became emperor of France in 1804.|Napoleon Bonaparte|Napoleon|europe
history|European History|600|This 1815 battle ended Napoleon's final campaign.|Battle of Waterloo|Waterloo|europe
history|European History|800|This Russian czar issued the 1861 emancipation of the serfs.|Alexander II|Czar Alexander II|europe
history|World Wars|200|This 1944 Allied invasion landed on beaches in Normandy.|D-Day|Operation Overlord|world-wars
history|World Wars|400|This 1914 assassination in Sarajevo helped spark World War I.|Archduke Franz Ferdinand|Franz Ferdinand|world-wars
history|World Wars|600|This 1942 battle is often called a turning point in the Pacific War.|Battle of Midway|Midway|world-wars
history|World Wars|800|This conference placed Roosevelt, Churchill, and Stalin together in Crimea in 1945.|Yalta Conference|Yalta|world-wars
history|Revolutions & Independence Movements|200|This Caribbean nation became independent after a successful slave revolt ending in 1804.|Haiti||revolutions
history|Revolutions & Independence Movements|400|This South American liberator is known as El Libertador.|Simon Bolivar|Bolivar|revolutions
history|Revolutions & Independence Movements|600|This 1917 Russian revolution brought the Bolsheviks to power.|October Revolution|Bolshevik Revolution|revolutions
history|Empires & Dynasties|200|This empire built roads, legions, and an arena called the Colosseum.|Roman Empire|Rome|empires
history|Empires & Dynasties|400|This Chinese dynasty built much of the Great Wall and standardized writing.|Qin Dynasty|Qin|dynasties
history|Empires & Dynasties|600|This empire was ruled from Istanbul after the capture of Constantinople in 1453.|Ottoman Empire|Ottomans|empires
history|Historical Figures|200|This Indian leader used nonviolent resistance against British rule.|Mahatma Gandhi|Gandhi|figures
history|Historical Figures|400|This nurse became known as the Lady with the Lamp during the Crimean War.|Florence Nightingale|Nightingale|figures
history|Historical Figures|600|This Mongol ruler founded the largest contiguous land empire in history.|Genghis Khan||figures
history|Dates, Documents & Treaties|200|This 1776 document announced the American colonies' separation from Britain.|Declaration of Independence||documents
history|Dates, Documents & Treaties|400|This 1787 document begins with We the People.|U.S. Constitution|United States Constitution|documents
geography|World Capitals|200|This city is both the capital of France and the home of the Louvre.|Paris||capitals
geography|World Capitals|400|This capital of Japan sits on Tokyo Bay.|Tokyo||capitals
geography|World Capitals|600|This capital of Argentina stands on the Rio de la Plata.|Buenos Aires||capitals
geography|World Capitals|800|This capital of Kenya is a major city near Nairobi National Park.|Nairobi||capitals
geography|World Capitals|1000|This capital of Kazakhstan replaced Almaty as the national capital in 1997.|Astana|Nur-Sultan|capitals
geography|Countries & Borders|200|This country shares the world's longest undefended border with the United States.|Canada||borders
geography|Countries & Borders|400|This country borders both Portugal and France on the Iberian Peninsula.|Spain||borders
geography|Countries & Borders|600|This landlocked country lies between India and China in the Himalayas.|Nepal||borders
geography|Countries & Borders|800|This country is surrounded entirely by South Africa.|Lesotho||borders
geography|Countries & Borders|1000|This enclave country is surrounded by Italy and is home to Mount Titano.|San Marino||borders
geography|U.S. States & Cities|200|This state has Sacramento as its capital.|California||us-geography
geography|U.S. States & Cities|400|This Illinois city sits on Lake Michigan and is nicknamed the Windy City.|Chicago||us-cities
geography|U.S. States & Cities|600|This state includes the cities of Albuquerque and Santa Fe.|New Mexico||us-states
geography|U.S. States & Cities|800|This state capital is named for the fourth U.S. president.|Madison|Madison, Wisconsin|us-cities
geography|U.S. States & Cities|1000|This smallest U.S. state by area has Providence as its capital.|Rhode Island||us-states
geography|Rivers, Lakes & Seas|200|This longest river in Africa flows north through Egypt.|Nile|Nile River|rivers
geography|Rivers, Lakes & Seas|400|This river forms much of the border between Texas and Mexico.|Rio Grande||rivers
geography|Rivers, Lakes & Seas|600|This largest freshwater lake by surface area borders the U.S. and Canada.|Lake Superior||lakes
geography|Rivers, Lakes & Seas|800|This sea between Europe and Africa includes the Balearic and Aegean areas.|Mediterranean Sea|Mediterranean|seas
geography|Rivers, Lakes & Seas|1000|This river flows through Baghdad before joining the Euphrates.|Tigris|Tigris River|rivers
geography|Mountains & Deserts|200|This tallest mountain in the world rises in the Himalayas.|Mount Everest|Everest|mountains
geography|Mountains & Deserts|400|This desert covers much of northern Africa.|Sahara|Sahara Desert|deserts
geography|Mountains & Deserts|600|This South American mountain range runs along the continent's western edge.|Andes|Andes Mountains|mountains
geography|Mountains & Deserts|800|This desert in Mongolia and China is known for harsh temperatures.|Gobi Desert|Gobi|deserts
geography|Mountains & Deserts|1000|This volcanic mountain is the highest peak in Japan.|Mount Fuji|Fuji|mountains
geography|Islands & Archipelagos|200|This largest island in the Mediterranean is part of Italy.|Sicily||islands
geography|Islands & Archipelagos|400|This Indonesian island includes Denpasar and many Hindu temples.|Bali||islands
geography|Islands & Archipelagos|600|This Danish territory is the world's largest island.|Greenland||islands
geography|Islands & Archipelagos|800|This Portuguese archipelago in the Atlantic includes Sao Miguel.|Azores|the Azores|islands
geography|World Regions|200|This region includes Norway, Sweden, and Denmark.|Scandinavia||regions
geography|World Regions|400|This region of southern Argentina and Chile includes glaciers and windswept plains.|Patagonia||regions
geography|World Regions|600|This region around the Amazon River spans parts of Brazil, Peru, and other countries.|Amazon Basin|the Amazon Basin|regions
geography|World Regions|800|This Belgian region is primarily Dutch-speaking.|Flanders||regions
geography|Landmarks & UNESCO Sites|200|This ancient amphitheater stands in Rome.|Colosseum|the Colosseum|landmarks
geography|Landmarks & UNESCO Sites|400|This Inca site sits above the Urubamba Valley in Peru.|Machu Picchu||landmarks
geography|Landmarks & UNESCO Sites|600|This Cambodian temple complex includes Angkor Wat.|Angkor|Angkor Wat|landmarks
geography|Landmarks & UNESCO Sites|800|This prehistoric stone circle stands on Salisbury Plain in England.|Stonehenge||landmarks
geography|Demonyms & Languages|200|This demonym describes a person from Denmark.|Dane|Danish person|demonyms
geography|Demonyms & Languages|400|This language is primarily spoken in Brazil.|Portuguese||languages
geography|Demonyms & Languages|600|This demonym describes a person from New Zealand.|New Zealander|Kiwi|demonyms
geography|Demonyms & Languages|800|This official language of Ethiopia uses the Ge'ez script.|Amharic||languages
geography|Maps, Coordinates & Extremes|200|This imaginary line at 0 degrees latitude divides Earth into northern and southern hemispheres.|Equator|the equator|maps
geography|Maps, Coordinates & Extremes|400|This imaginary line near 180 degrees longitude is associated with calendar-date changes.|International Date Line|date line|maps
geography|Maps, Coordinates & Extremes|600|This point on Earth is at 90 degrees north latitude.|North Pole|the North Pole|maps
geography|Maps, Coordinates & Extremes|800|This lowest point on land lies along the border of Israel and Jordan.|Dead Sea|the Dead Sea|extremes
geography|Maps, Coordinates & Extremes|1000|This antipodal point from the Greenwich meridian lies at 180 degrees longitude.|Antimeridian|180th meridian|maps
geography|World Capitals|600|This capital of Vietnam sits on the Red River.|Hanoi||capitals
geography|Countries & Borders|800|This country shares the island of Hispaniola with Haiti.|Dominican Republic||borders
geography|Landmarks & UNESCO Sites|1000|This Jordanian archaeological city is famous for a rock-cut facade called Al-Khazneh.|Petra||landmarks
science|Biology|200|This molecule carries genetic instructions in most living organisms.|DNA|deoxyribonucleic acid|biology
science|Biology|400|This cell structure is often called the powerhouse of the cell.|Mitochondrion|mitochondria|biology
science|Biology|600|This process uses sunlight to convert carbon dioxide and water into sugars.|Photosynthesis||biology
science|Biology|800|This scientist proposed natural selection after studying variation and adaptation.|Charles Darwin|Darwin|biology
science|Biology|1000|This kingdom includes mushrooms, molds, and yeasts.|Fungi|fungus|biology
science|Chemistry|200|This element has the chemical symbol Fe.|Iron||chemistry
science|Chemistry|400|This noble gas fills some glowing signs and has atomic number 10.|Neon||chemistry
science|Chemistry|600|This scale measures acidity and alkalinity from 0 to 14.|pH scale|pH|chemistry
science|Chemistry|800|This bond involves the sharing of electron pairs between atoms.|Covalent bond|covalent bonding|chemistry
science|Chemistry|1000|This scientist arranged elements into a periodic table and predicted missing ones.|Dmitri Mendeleev|Mendeleev|chemistry
science|Physics|200|This force keeps planets in orbit around the Sun.|Gravity|gravitation|physics
science|Physics|400|This unit named for Isaac Newton measures force.|Newton||physics
science|Physics|600|This law says every action has an equal and opposite reaction.|Newton's third law|third law of motion|physics
science|Physics|800|This particle carries a negative electric charge in atoms.|Electron||physics
science|Physics|1000|This theory links mass and energy with the formula E equals mc squared.|Special relativity|relativity|physics
science|Astronomy & Space|200|This planet is known as the Red Planet.|Mars||space
science|Astronomy & Space|400|This galaxy contains the Solar System.|Milky Way|Milky Way Galaxy|space
science|Astronomy & Space|600|This telescope launched in 1990 and has produced deep-field images.|Hubble Space Telescope|Hubble|space
science|Astronomy & Space|800|This dwarf planet was reclassified from planet status in 2006.|Pluto||space
science|Astronomy & Space|1000|This boundary around a black hole marks the point beyond which light cannot escape.|Event horizon||space
science|Earth Science|200|This layer of Earth lies between the crust and the core.|Mantle||earth-science
science|Earth Science|400|This scale measures earthquake magnitude.|Richter scale|Richter magnitude scale|earth-science
science|Earth Science|600|This rock type forms from cooled magma or lava.|Igneous rock|igneous|earth-science
science|Earth Science|800|This atmospheric layer contains most of Earth's ozone layer.|Stratosphere||earth-science
science|Earth Science|1000|This supercontinent began breaking apart during the Mesozoic Era.|Pangaea|Pangea|earth-science
science|Medicine & Anatomy|200|This organ pumps blood through the circulatory system.|Heart|the heart|anatomy
science|Medicine & Anatomy|400|This largest organ of the human body protects against infection and water loss.|Skin|the skin|anatomy
science|Medicine & Anatomy|600|This hormone made by the pancreas helps regulate blood sugar.|Insulin||medicine
science|Medicine & Anatomy|800|This bone is commonly called the collarbone.|Clavicle||anatomy
science|Medicine & Anatomy|1000|This part of the brain coordinates balance and fine motor control.|Cerebellum||anatomy
science|Animals & Plants|200|This process lets plants release water vapor through their leaves.|Transpiration||plants
science|Animals & Plants|400|This marsupial carries young called joeys in a pouch.|Kangaroo||animals
science|Animals & Plants|600|This pigment gives plants their green color and helps absorb light.|Chlorophyll||plants
science|Animals & Plants|800|This mammal lays eggs and has a duck-like bill.|Platypus||animals
science|Animals & Plants|1000|This plant family includes peas, beans, lentils, and peanuts.|Legumes|legume family|plants
science|Inventions & Discoveries|200|This Scottish inventor is often credited with improving the practical telephone.|Alexander Graham Bell|Bell|inventions
science|Inventions & Discoveries|400|This vaccine pioneer used cowpox to protect against smallpox.|Edward Jenner|Jenner|medicine
science|Inventions & Discoveries|600|This discovery by Fleming led to the first widely used antibiotic.|Penicillin||medicine
science|Inventions & Discoveries|800|This physicist discovered X-rays in 1895.|Wilhelm Roentgen|Roentgen|discoveries
science|Scientists|400|This Polish-born scientist won Nobel Prizes in physics and chemistry.|Marie Curie|Curie|scientists
science|Scientists|600|This astronomer argued for a Sun-centered model in De revolutionibus.|Nicolaus Copernicus|Copernicus|scientists
science|Units, Laws & Constants|400|This constant, about 6.022 times 10 to the 23rd, counts particles in a mole.|Avogadro's number|Avogadro constant|constants
science|Units, Laws & Constants|600|This SI unit named for a French physicist measures electric current.|Ampere|amp|units
science|Physics|800|This quantum particle of light carries electromagnetic radiation.|Photon||physics
science|Chemistry|800|This process splits water into hydrogen and oxygen using electricity.|Electrolysis||chemistry
science|Astronomy & Space|800|This cloud of icy bodies is thought to surround the Solar System far beyond Pluto.|Oort Cloud|the Oort Cloud|space
science|Earth Science|600|This boundary separates Earth's crust from the mantle.|Mohorovicic discontinuity|Moho|earth-science
science|Medicine & Anatomy|800|This artery carries oxygen-rich blood from the heart to the body.|Aorta|the aorta|anatomy
science|Animals & Plants|600|This animal group includes frogs, salamanders, and caecilians.|Amphibians|amphibia|animals
science|Scientists|800|This physicist formulated the uncertainty principle.|Werner Heisenberg|Heisenberg|scientists
arts_visual_culture|Painters & Sculptors|800|This Spanish court painter created Las Meninas.|Diego Velazquez|Velazquez|art
arts_visual_culture|Painters & Sculptors|1000|This Romanian-born sculptor created Bird in Space.|Constantin Brancusi|Brancusi|sculpture
arts_visual_culture|Famous Artworks|800|This Grant Wood painting shows a farmer with a pitchfork beside a woman.|American Gothic||artworks
arts_visual_culture|Famous Artworks|1000|This Raphael fresco gathers ancient philosophers in a grand architectural setting.|The School of Athens|School of Athens|artworks
arts_visual_culture|Art Movements|1000|This Russian-born painter helped pioneer abstract art and wrote Concerning the Spiritual in Art.|Wassily Kandinsky|Kandinsky|movements
arts_visual_culture|Architecture|800|This architect designed the glass pyramid at the Louvre.|I. M. Pei|IM Pei;Ieoh Ming Pei|architecture
arts_visual_culture|Architecture|1000|This Le Corbusier chapel in France is famous for its sculptural roof at Ronchamp.|Notre-Dame du Haut|Ronchamp chapel|architecture
arts_visual_culture|Museums & Collections|800|This St. Petersburg museum began with Catherine the Great's collection.|Hermitage Museum|the Hermitage|museums
arts_visual_culture|Photography|1000|This photographer published The Americans after traveling the United States in the 1950s.|Robert Frank|Frank|photography
arts_visual_culture|Design & Decorative Arts|800|This simple chair design by Charles and Ray Eames uses molded plywood and leather cushions.|Eames lounge chair|lounge chair|design
arts_visual_culture|Public Art & Monuments|800|This Washington monument honors the author of the Declaration of Independence with a domed memorial.|Jefferson Memorial|Thomas Jefferson Memorial|monuments
arts_visual_culture|Art Terms & Techniques|800|This Italian term means smoke-like softness in painting and is associated with Leonardo.|Sfumato||technique
arts_visual_culture|Patrons, Critics & Schools|1000|This Harlem Renaissance patron promoted Black artists and writers as the New Negro movement grew.|Alain Locke|Locke|criticism
arts_visual_culture|Painters & Sculptors|600|This American sculptor designed the Vietnam Veterans Memorial while still a Yale student.|Maya Lin|Lin|sculpture
arts_visual_culture|Famous Artworks|600|This Hokusai woodblock print shows a towering wave near Mount Fuji.|The Great Wave off Kanagawa|Great Wave|artworks
arts_visual_culture|Art Movements|800|This art movement used commercial imagery and included Warhol and Lichtenstein.|Pop Art||movements
music_performing_arts|Classical Composers|200|This Austrian child prodigy composed The Magic Flute and Don Giovanni.|Wolfgang Amadeus Mozart|Mozart|classical
music_performing_arts|Classical Composers|400|This composer wrote The Four Seasons.|Antonio Vivaldi|Vivaldi|classical
music_performing_arts|Classical Composers|600|This Russian composer wrote the 1812 Overture and Swan Lake.|Pyotr Ilyich Tchaikovsky|Tchaikovsky|classical
music_performing_arts|Classical Composers|800|This German composer wrote the Ring cycle of operas.|Richard Wagner|Wagner|classical
music_performing_arts|Opera|200|This Puccini opera features the aria Nessun dorma.|Turandot||opera
music_performing_arts|Opera|400|This Bizet opera follows a cigarette factory worker in Seville.|Carmen||opera
music_performing_arts|Opera|600|This Verdi opera is set in ancient Egypt and includes a triumphal march.|Aida||opera
music_performing_arts|Opera|800|This Mozart opera features the Queen of the Night.|The Magic Flute|Magic Flute|opera
music_performing_arts|Broadway & Musicals|200|This musical about Alexander Hamilton was created by Lin-Manuel Miranda.|Hamilton||broadway
music_performing_arts|Broadway & Musicals|400|This musical features Elphaba, Glinda, and the song Defying Gravity.|Wicked||broadway
music_performing_arts|Broadway & Musicals|600|This musical follows Jean Valjean and Inspector Javert.|Les Miserables||broadway
music_performing_arts|Broadway & Musicals|800|This Stephen Sondheim musical explores fairy tales in Into the Woods.|Into the Woods||broadway
music_performing_arts|Popular Music|200|This singer released Thriller, one of the best-selling albums ever.|Michael Jackson|Jackson|pop-music
music_performing_arts|Popular Music|400|This British band released Sgt. Pepper's Lonely Hearts Club Band.|The Beatles|Beatles|pop-music
music_performing_arts|Popular Music|600|This artist's album Purple Rain also served as a film soundtrack.|Prince||pop-music
music_performing_arts|Popular Music|800|This Canadian singer-songwriter wrote Hallelujah.|Leonard Cohen|Cohen|pop-music
music_performing_arts|Jazz & Blues|200|This trumpeter and singer was nicknamed Satchmo.|Louis Armstrong|Armstrong|jazz
music_performing_arts|Jazz & Blues|400|This jazz bandleader composed Take the A Train.|Duke Ellington|Ellington|jazz
music_performing_arts|Jazz & Blues|600|This blues guitarist is linked with the legend of selling his soul at a crossroads.|Robert Johnson|Johnson|blues
music_performing_arts|Instruments|200|This keyboard instrument uses hammers to strike strings.|Piano||instruments
music_performing_arts|Instruments|400|This double-reed woodwind is used to tune an orchestra before concerts.|Oboe||instruments
music_performing_arts|Instruments|600|This large brass instrument has a slide instead of valves.|Trombone||instruments
music_performing_arts|Music Theory & Terms|200|This term names the speed of a piece of music.|Tempo||music-theory
music_performing_arts|Music Theory & Terms|400|This symbol raises a note by a half step.|Sharp||music-theory
music_performing_arts|Music Theory & Terms|600|This Italian term means gradually getting louder.|Crescendo||music-theory
music_performing_arts|Dance|200|This classical dance form uses pointe shoes and positions at the barre.|Ballet||dance
music_performing_arts|Dance|400|This Argentine dance is associated with close holds and dramatic steps.|Tango||dance
music_performing_arts|Dance|600|This Spanish dance form uses hand claps, footwork, and guitar.|Flamenco||dance
music_performing_arts|Theater|200|This ancient Greek playwright wrote Oedipus Rex.|Sophocles||theater
music_performing_arts|Theater|400|This Russian playwright wrote The Cherry Orchard and Uncle Vanya.|Anton Chekhov|Chekhov|theater
music_performing_arts|Theater|600|This theater term names a speech by one actor alone onstage.|Soliloquy||theater
music_performing_arts|Film Scores & Soundtracks|200|This composer wrote the Star Wars and Indiana Jones themes.|John Williams|Williams|film-score
music_performing_arts|Film Scores & Soundtracks|400|This song from Titanic was performed by Celine Dion.|My Heart Will Go On||soundtrack
music_performing_arts|Film Scores & Soundtracks|600|This composer scored The Lion King and Gladiator.|Hans Zimmer|Zimmer|film-score
religion_mythology_philosophy|Greek Mythology|400|This Greek hero completed twelve labors.|Heracles|Hercules|greek-myth
religion_mythology_philosophy|Greek Mythology|600|This Greek goddess of the harvest searched for Persephone.|Demeter||greek-myth
religion_mythology_philosophy|Roman & Norse Mythology|400|This Norse hall receives warriors chosen by the Valkyries.|Valhalla||norse
religion_mythology_philosophy|Roman & Norse Mythology|600|This Roman goddess of love corresponds to the Greek Aphrodite.|Venus||roman
religion_mythology_philosophy|World Mythology|400|This Egyptian god of the afterlife is often shown with green skin.|Osiris||egyptian-myth
religion_mythology_philosophy|World Mythology|600|This Hindu god is known as the preserver in the Trimurti.|Vishnu||hinduism
religion_mythology_philosophy|Bible|400|This sea parted in the Exodus story.|Red Sea|the Red Sea|bible
religion_mythology_philosophy|Bible|600|This king asks for wisdom in the Hebrew Bible.|Solomon|King Solomon|bible
religion_mythology_philosophy|World Religions|400|This city is home to the Kaaba.|Mecca|Makkah|islam
religion_mythology_philosophy|World Religions|600|This Buddhist term means release from suffering and the cycle of rebirth.|Nirvana||buddhism
religion_mythology_philosophy|Religious Texts & Terms|400|This Jewish prayer beginning Shema Yisrael declares the oneness of God.|Shema||judaism
religion_mythology_philosophy|Religious Texts & Terms|600|This collection of sayings is attributed to Confucius and his disciples.|Analects|The Analects|confucianism
religion_mythology_philosophy|Philosophers|400|This philosopher wrote The Second Sex.|Simone de Beauvoir|de Beauvoir|philosophy
religion_mythology_philosophy|Philosophers|600|This philosopher wrote Thus Spoke Zarathustra.|Friedrich Nietzsche|Nietzsche|philosophy
religion_mythology_philosophy|Philosophical Schools|400|This ancient school associated with Pyrrho emphasized suspension of judgment.|Skepticism|Pyrrhonism|philosophy
religion_mythology_philosophy|Philosophical Schools|600|This Chinese philosophy associated with Laozi emphasizes the Dao.|Daoism|Taoism|philosophy
religion_mythology_philosophy|Ethics & Political Thought|400|This philosopher wrote A Theory of Justice.|John Rawls|Rawls|ethics
religion_mythology_philosophy|Ethics & Political Thought|600|This Kantian idea says to act only on a maxim you could will as universal law.|Categorical imperative|the categorical imperative|ethics
religion_mythology_philosophy|Symbols, Rituals & Holidays|400|This Christian holiday commemorates the resurrection of Jesus.|Easter||christianity
religion_mythology_philosophy|Symbols, Rituals & Holidays|600|This Islamic month includes fasting from dawn to sunset.|Ramadan||islam
religion_mythology_philosophy|Greek Mythology|800|This Greek hero flew too close to the sun with waxen wings.|Icarus||greek-myth
religion_mythology_philosophy|World Religions|800|This Sikh scripture is treated as the eternal guru.|Guru Granth Sahib||sikhism
religion_mythology_philosophy|Philosophers|800|This Scottish philosopher wrote A Treatise of Human Nature.|David Hume|Hume|philosophy
language_wordplay|Definitions|1000|This adjective means showing keen mental discernment and good judgment.|Sagacious|sagacious|definitions
sports_games_leisure|Baseball|200|This New York Yankees slugger was nicknamed the Bambino.|Babe Ruth|Ruth|baseball
sports_games_leisure|Baseball|400|This statistic abbreviates runs batted in.|RBI|runs batted in|baseball
sports_games_leisure|Baseball|600|This pitcher threw for the Brooklyn and Los Angeles Dodgers and retired at age 30.|Sandy Koufax|Koufax|baseball
sports_games_leisure|Baseball|800|This ballpark's Green Monster stands in left field.|Fenway Park|Fenway|baseball
sports_games_leisure|Football|200|This NFL team won the first two Super Bowls under Vince Lombardi.|Green Bay Packers|Packers|football
sports_games_leisure|Football|400|This quarterback won seven Super Bowls.|Tom Brady|Brady|football
sports_games_leisure|Football|600|This college football trophy is awarded annually to the most outstanding player.|Heisman Trophy|Heisman|football
sports_games_leisure|Football|800|This position usually snaps the ball to begin a football play.|Center|centre|football
sports_games_leisure|Basketball|200|This Chicago Bulls star wore number 23 and won six NBA championships.|Michael Jordan|Jordan|basketball
sports_games_leisure|Basketball|400|This team won 11 NBA titles with Bill Russell.|Boston Celtics|Celtics|basketball
sports_games_leisure|Basketball|600|This shot behind the arc is worth three points.|Three-pointer|three point shot|basketball
sports_games_leisure|Basketball|800|This WNBA franchise won multiple titles behind Sue Bird and Lauren Jackson.|Seattle Storm|Storm|basketball
sports_games_leisure|Soccer|200|This global soccer tournament is held every four years by FIFA.|World Cup|FIFA World Cup|soccer
sports_games_leisure|Soccer|400|This Argentine star won the 2022 FIFA World Cup.|Lionel Messi|Messi|soccer
sports_games_leisure|Soccer|600|This club plays home matches at Camp Nou.|FC Barcelona|Barcelona|soccer
sports_games_leisure|Soccer|800|This term names three goals by one player in a single match.|Hat trick|hat-trick|soccer
sports_games_leisure|Tennis & Golf|200|This tennis tournament is played on grass at the All England Club.|Wimbledon||tennis
sports_games_leisure|Tennis & Golf|400|This golfer is nicknamed the Golden Bear.|Jack Nicklaus|Nicklaus|golf
sports_games_leisure|Tennis & Golf|600|This tennis score follows deuce when one player wins the next point.|Advantage||tennis
sports_games_leisure|Tennis & Golf|800|This golf tournament awards a green jacket to its winner.|The Masters|Masters Tournament|golf
sports_games_leisure|Olympics|200|This city hosted the 2008 Summer Olympics.|Beijing||olympics
sports_games_leisure|Olympics|400|This swimmer won eight gold medals at the 2008 Olympics.|Michael Phelps|Phelps|olympics
sports_games_leisure|Olympics|600|This Olympic event combines swimming, cycling, and running.|Triathlon||olympics
sports_games_leisure|Sports Records & Awards|400|This baseball award honors each league's top pitcher.|Cy Young Award|Cy Young|awards
sports_games_leisure|Sports Records & Awards|600|This NHL trophy is awarded to the league's playoff champion.|Stanley Cup||hockey
sports_games_leisure|Sports Records & Awards|800|This NBA award honors the league's most valuable player.|MVP Award|Most Valuable Player Award|awards
sports_games_leisure|Rules & Terminology|200|This baseball count has three balls and two strikes.|Full count||rules
sports_games_leisure|Rules & Terminology|400|This soccer infraction occurs when an attacker is too far ahead of the defense when the ball is played.|Offside|offsides|rules
sports_games_leisure|Rules & Terminology|600|This tennis term means a serve that the opponent cannot touch.|Ace||rules
sports_games_leisure|Board Games & Card Games|200|This board game has a boardwalk and a jail square.|Monopoly||board-games
sports_games_leisure|Board Games & Card Games|400|This card game uses bidding and tricks with a trump suit.|Bridge||card-games
sports_games_leisure|Board Games & Card Games|600|This game uses letter tiles worth points on a crossword-like board.|Scrabble||board-games
sports_games_leisure|Video Games & Esports|200|This Nintendo plumber first battled Donkey Kong in an arcade game.|Mario||video-games
sports_games_leisure|Video Games & Esports|400|This Microsoft console brand launched with Halo.|Xbox||video-games
sports_games_leisure|Video Games & Esports|600|This battle royale game from Epic features building and a shrinking storm.|Fortnite||video-games
sports_games_leisure|Video Games & Esports|800|This Riot Games title is a five-on-five MOBA with champions and lanes.|League of Legends||video-games
pop_culture_media_modern_life|Film|200|This 1977 space film introduced Luke Skywalker and Darth Vader.|Star Wars|A New Hope;Star Wars Episode IV|film
pop_culture_media_modern_life|Film|400|This Spielberg film made viewers afraid of a great white shark.|Jaws||film
pop_culture_media_modern_life|Film|600|This 1994 film follows Andy Dufresne in a Maine prison.|The Shawshank Redemption|Shawshank Redemption|film
pop_culture_media_modern_life|Film|800|This Miyazaki film features Chihiro in a spirit world bathhouse.|Spirited Away||film
pop_culture_media_modern_life|Television|200|This sitcom features Rachel, Ross, Monica, Chandler, Joey, and Phoebe.|Friends||television
pop_culture_media_modern_life|Television|400|This HBO series follows rival noble families in Westeros.|Game of Thrones||television
pop_culture_media_modern_life|Television|600|This animated series is set in the town of Springfield.|The Simpsons|Simpsons|television
pop_culture_media_modern_life|Television|800|This drama begins with chemistry teacher Walter White turning to meth production.|Breaking Bad||television
pop_culture_media_modern_life|Streaming & Internet Culture|200|This video platform popularized channels, creators, and the subscribe button.|YouTube||internet
pop_culture_media_modern_life|Streaming & Internet Culture|400|This Netflix series made a chess prodigy named Beth Harmon a streaming hit.|The Queen's Gambit|Queen's Gambit|streaming
pop_culture_media_modern_life|Streaming & Internet Culture|600|This term names a short looping reaction image used online.|GIF|animated GIF|internet
pop_culture_media_modern_life|Comics & Graphic Novels|200|This Marvel hero was bitten by a radioactive spider.|Spider-Man|Spiderman|comics
pop_culture_media_modern_life|Comics & Graphic Novels|400|This DC hero is also known as the Dark Knight.|Batman||comics
pop_culture_media_modern_life|Comics & Graphic Novels|600|This Alan Moore graphic novel features Rorschach and Doctor Manhattan.|Watchmen||comics
pop_culture_media_modern_life|Comics & Graphic Novels|800|This manga by Eiichiro Oda follows Monkey D. Luffy.|One Piece||manga
pop_culture_media_modern_life|Celebrities & Public Figures|200|This media mogul hosted a long-running daytime talk show from Chicago.|Oprah Winfrey|Oprah|public-figures
pop_culture_media_modern_life|Celebrities & Public Figures|400|This actor played Iron Man in the Marvel Cinematic Universe.|Robert Downey Jr.|RDJ|celebrities
pop_culture_media_modern_life|Celebrities & Public Figures|600|This chef hosts shows including Parts Unknown before his death in 2018.|Anthony Bourdain|Bourdain|celebrities
pop_culture_media_modern_life|Brands & Advertising|200|This company uses the swoosh logo.|Nike||brands
pop_culture_media_modern_life|Brands & Advertising|400|This fast-food chain is associated with the Golden Arches.|McDonald's|McDonalds|brands
pop_culture_media_modern_life|Brands & Advertising|600|This credit-card company ran the slogan Don't leave home without it.|American Express|AmEx|advertising
pop_culture_media_modern_life|Food & Drink|200|This Japanese dish often pairs vinegared rice with raw fish.|Sushi||food
pop_culture_media_modern_life|Food & Drink|400|This Italian dessert layers coffee-soaked ladyfingers with mascarpone.|Tiramisu||food
pop_culture_media_modern_life|Food & Drink|600|This Mexican sauce can combine chiles, spices, and chocolate.|Mole|mole sauce|food
pop_culture_media_modern_life|Food & Drink|800|This French term names vegetables cut into long thin strips.|Julienne||food
pop_culture_media_modern_life|Fashion & Lifestyle|200|This denim fabric is commonly used for blue jeans.|Denim||fashion
pop_culture_media_modern_life|Fashion & Lifestyle|400|This French fashion house is known for the interlocking double-C logo.|Chanel||fashion
pop_culture_media_modern_life|Fashion & Lifestyle|600|This Japanese organizing consultant popularized asking if items spark joy.|Marie Kondo|Kondo|lifestyle
pop_culture_media_modern_life|Fashion & Lifestyle|800|This Italian luxury brand is associated with a double-G monogram.|Gucci||fashion
pop_culture_media_modern_life|Technology & Companies|200|This company makes the iPhone.|Apple||technology
pop_culture_media_modern_life|Technology & Companies|400|This search company reorganized under Alphabet in 2015.|Google||technology
pop_culture_media_modern_life|Technology & Companies|600|This company founded by Jeff Bezos began as an online bookstore.|Amazon||technology
pop_culture_media_modern_life|Technology & Companies|800|This programming language shares its name with a type of coffee.|Java||technology
pop_culture_media_modern_life|Recent Events & Current Affairs|200|This global health agency is abbreviated WHO.|World Health Organization|WHO|current-affairs
pop_culture_media_modern_life|Recent Events & Current Affairs|400|This agreement aims to limit global warming and is named for a French capital.|Paris Agreement|Paris climate agreement|current-affairs
pop_culture_media_modern_life|Recent Events & Current Affairs|600|This telescope released its first full-color images in 2022.|James Webb Space Telescope|JWST|current-affairs
pop_culture_media_modern_life|Recent Events & Current Affairs|800|This cryptocurrency introduced in 2009 uses a blockchain and proof of work.|Bitcoin||current-affairs
pop_culture_media_modern_life|Technology & Companies|1000|This open-source operating system kernel was created by Linus Torvalds.|Linux||technology
`;

await main();
