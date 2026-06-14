import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const outputDir = path.join(rootDir, 'data', 'acquisition', 'normalized');
const label = process.argv[2] ?? 'strategy-pack-001';

const rankByValue = { 200: 1, 400: 2, 600: 3, 800: 4, 1000: 5 };

const rows = String.raw`
literature_books|Authors & Works|200|standard||This author sent Alice down a rabbit hole and through a looking-glass.|Lewis Carroll|Charles Dodgson;Carroll|strategy-pack;authors
literature_books|Authors & Works|400|standard||This novelist wrote Beloved and Song of Solomon and won the Nobel Prize in Literature.|Toni Morrison|Morrison|strategy-pack;authors
literature_books|Authors & Works|600|standard||This Chilean author wrote The House of the Spirits and is the niece of a former president.|Isabel Allende|Allende|strategy-pack;authors
literature_books|Authors & Works|800|standard||This Nigerian novelist wrote Things Fall Apart about Okonkwo and colonial disruption.|Chinua Achebe|Achebe|strategy-pack;authors
literature_books|19th-Century Novels|200|standard||This Austen novel follows Elizabeth Bennet and Mr. Darcy through misunderstandings and proposals.|Pride and Prejudice|Pride & Prejudice|strategy-pack;19th-century
literature_books|19th-Century Novels|400|standard||This Hugo novel centers on Jean Valjean after his release from prison.|Les Miserables|Les Misérables;Les Mis|strategy-pack;19th-century
literature_books|Shakespeare & Drama|600|standard||This Shakespeare play strands Prospero and Miranda on an island with Ariel and Caliban.|The Tempest|Tempest|strategy-pack;shakespeare
literature_books|Shakespeare & Drama|800|standard||This Sophocles tragedy features a king who seeks a plague's cause and discovers himself.|Oedipus Rex|Oedipus the King|strategy-pack;drama
literature_books|Poetry|400|standard||This poet addressed a Grecian urn and a nightingale in famous odes.|John Keats|Keats|strategy-pack;poetry
literature_books|Poetry|1000|standard||This medieval English poet framed stories as a pilgrimage to Canterbury.|Geoffrey Chaucer|Chaucer|strategy-pack;poetry
literature_books|Children's & Young Adult Literature|200|standard||This book by E. B. White features a spider who writes words in a web for a pig.|Charlotte's Web|Charlottes Web|strategy-pack;childrens
literature_books|Children's & Young Adult Literature|600|standard||This Philip Pullman novel begins His Dark Materials with Lyra Belacqua and her daemon.|The Golden Compass|Northern Lights|strategy-pack;young-adult
literature_books|American Literature|400|standard||This Salinger novel follows Holden Caulfield after he leaves Pencey Prep.|The Catcher in the Rye|Catcher in the Rye|strategy-pack;american-literature
literature_books|American Literature|800|standard||This Steinbeck novel follows the Joad family from Oklahoma toward California.|The Grapes of Wrath|Grapes of Wrath|strategy-pack;american-literature
literature_books|British & Irish Literature|600|standard||This Virginia Woolf novel follows Clarissa through a London day as she prepares for a party.|Mrs. Dalloway|Mrs Dalloway|strategy-pack;british-literature
literature_books|World Literature|1000|standard||This Argentine author wrote Labyrinths and stories about mirrors, libraries, and infinite books.|Jorge Luis Borges|Borges|strategy-pack;world-literature
literature_books|Literary Characters|200|standard||This orphan from Kansas travels with a scarecrow, tin man, and lion.|Dorothy Gale|Dorothy|strategy-pack;characters
literature_books|Literary Characters|600|standard||This Cervantes sidekick rides a donkey and serves a deluded knight.|Sancho Panza|Sancho|strategy-pack;characters
literature_books|Awards, Movements & Terms|800|standard||This literary movement used interior monologue and fractured chronology in writers like Joyce and Woolf.|Modernism|literary modernism|strategy-pack;literary-terms
literature_books|Awards, Movements & Terms|1000|standard||This annual British prize for fiction was first awarded in 1969 and went to P. H. Newby.|Booker Prize|Man Booker Prize|strategy-pack;awards
history|U.S. Presidents & Elections|200|standard||This president purchased Louisiana from France while Meriwether Lewis was his secretary.|Thomas Jefferson|Jefferson|strategy-pack;presidents
history|U.S. Presidents & Elections|400|standard||This president took office after Lincoln's assassination and later faced impeachment.|Andrew Johnson|Johnson|strategy-pack;presidents
history|U.S. Presidents & Elections|600|standard||This 1876 contest ended Reconstruction through a disputed compromise after the vote.|Election of 1876|1876 election|strategy-pack;elections
history|U.S. Presidents & Elections|1000|standard||This president's administration negotiated the Gadsden Purchase from Mexico.|Franklin Pierce|Pierce|strategy-pack;presidents
history|U.S. History|200|standard||This 1862 act granted western settlers 160 acres after residence and improvement.|Homestead Act|the Homestead Act|strategy-pack;us-history
history|U.S. History|400|standard||This 1919 constitutional change banned the manufacture and sale of alcoholic beverages.|Eighteenth Amendment|18th Amendment|strategy-pack;us-history
history|U.S. History|800|standard||This Harding-era affair involved naval oil reserves in Wyoming and California.|Teapot Dome scandal|Teapot Dome|strategy-pack;us-history
history|Ancient History|200|standard||This Macedonian king created an empire stretching from Greece to Egypt and India.|Alexander the Great|Alexander III|strategy-pack;ancient
history|Ancient History|600|standard||This Roman emperor made Christianity legal with the Edict of Milan.|Constantine|Constantine the Great|strategy-pack;ancient
history|Medieval & Renaissance History|400|standard||This plague devastated Europe in the mid-14th century.|Black Death|the Black Death|strategy-pack;medieval
history|Medieval & Renaissance History|1000|standard||This 1453 event ended the Byzantine Empire after an Ottoman siege.|Fall of Constantinople|capture of Constantinople|strategy-pack;medieval
history|European History|600|standard||This 1648 settlement helped end the Thirty Years' War and reshaped European sovereignty.|Peace of Westphalia|Treaty of Westphalia|strategy-pack;europe
history|European History|800|standard||This Prussian minister engineered German unification through blood and iron.|Otto von Bismarck|Bismarck|strategy-pack;europe
history|World Wars|200|standard||This U.S. naval base was attacked on December 7, 1941.|Pearl Harbor||strategy-pack;world-wars
history|World Wars|600|standard||This German plan for a two-front war called for a rapid attack through Belgium.|Schlieffen Plan|the Schlieffen Plan|strategy-pack;world-wars
history|Revolutions & Independence Movements|400|standard||This prison's fall is celebrated as a French national holiday on July 14.|Bastille|the Bastille|strategy-pack;revolutions
history|Empires & Dynasties|800|standard||This Indian dynasty built the Taj Mahal and ruled from the 16th to 19th centuries.|Mughal Empire|Mughals|strategy-pack;empires
history|Historical Figures|1000|standard||This Haitian revolutionary led forces against France before dying in captivity in 1803.|Toussaint Louverture|Louverture|strategy-pack;figures
history|Dates, Documents & Treaties|200|standard||This 1215 charter is often cited as a foundation for limits on royal power.|Magna Carta||strategy-pack;documents
history|Dates, Documents & Treaties|400|standard||This 1949 alliance was founded for collective defense across the North Atlantic.|NATO|North Atlantic Treaty Organization|strategy-pack;treaties
geography|World Capitals|200|standard||This capital of Greece lies near the Acropolis.|Athens||strategy-pack;capitals
geography|World Capitals|400|standard||This capital of Egypt sits on the Nile near Giza.|Cairo||strategy-pack;capitals
geography|World Capitals|600|standard||This capital of Peru was founded by Francisco Pizarro and is nicknamed the City of Kings.|Lima||strategy-pack;capitals
geography|World Capitals|800|standard||This capital of Ghana lies on the Gulf of Guinea.|Accra||strategy-pack;capitals
geography|Countries & Borders|200|standard||This republic shares an island with the U.K. territory that includes Belfast.|Ireland|Republic of Ireland|strategy-pack;borders
geography|Countries & Borders|600|standard||This country borders Germany, Austria, Slovakia, and Poland and has Prague as capital.|Czech Republic|Czechia|strategy-pack;borders
geography|Countries & Borders|1000|standard||This landlocked African country is surrounded by Senegal except for a short Atlantic coast.|The Gambia|Gambia|strategy-pack;borders
geography|U.S. States & Cities|400|standard||This state capital sits on the James River and was also the Confederate capital.|Richmond|Richmond, Virginia|strategy-pack;us-cities
geography|U.S. States & Cities|800|standard||This state contains Mount Katahdin and the easternmost point in the contiguous U.S.|Maine||strategy-pack;us-states
geography|Rivers, Lakes & Seas|200|standard||This river runs through London before reaching the North Sea.|Thames|River Thames|strategy-pack;rivers
geography|Rivers, Lakes & Seas|600|standard||This South American river system includes the Parana and Uruguay rivers.|Rio de la Plata|Río de la Plata|strategy-pack;rivers
geography|Rivers, Lakes & Seas|1000|standard||This Central Asian sea has shrunk dramatically after river diversions for irrigation.|Aral Sea|the Aral Sea|strategy-pack;seas
geography|Mountains & Deserts|400|standard||This North African mountain range runs through Morocco, Algeria, and Tunisia.|Atlas Mountains|Atlas|strategy-pack;mountains
geography|Mountains & Deserts|800|standard||This Chilean region is among the driest places on Earth.|Atacama Desert|Atacama|strategy-pack;deserts
geography|Islands & Archipelagos|200|standard||This New York City borough is connected to Brooklyn by the Verrazzano-Narrows Bridge.|Staten Island|Richmond County|strategy-pack;islands
geography|World Regions|600|standard||This region of France is known for sparkling wine made around Reims and Epernay.|Champagne||strategy-pack;regions
geography|Landmarks & UNESCO Sites|400|standard||This white marble mausoleum in Agra was built by Shah Jahan.|Taj Mahal|the Taj Mahal|strategy-pack;landmarks
geography|Landmarks & UNESCO Sites|1000|standard||This ancient Nabataean city in Jordan includes a rock-cut facade called Al-Khazneh.|Petra||strategy-pack;landmarks
geography|Demonyms & Languages|800|standard||This Celtic language is spoken in Wales and uses double-L sounds in many place names.|Welsh|Cymraeg|strategy-pack;languages
geography|Maps, Coordinates & Extremes|400|standard||This imaginary line at zero degrees longitude passes through Greenwich.|Prime meridian|Greenwich meridian|strategy-pack;maps
science|Biology|200|standard||This process copies DNA into RNA before translation can make a protein.|Transcription||strategy-pack;biology
science|Biology|600|standard||This organelle contains chlorophyll and performs photosynthesis in plant cells.|Chloroplast||strategy-pack;biology
science|Biology|1000|standard||This enzyme unzips DNA during replication by breaking hydrogen bonds.|Helicase|DNA helicase|strategy-pack;biology
science|Chemistry|200|standard||This element with symbol Na is a soft metal that reacts strongly with water.|Sodium||strategy-pack;chemistry
science|Chemistry|400|standard||This gas exhaled by humans is produced by respiration and combustion.|Carbon dioxide|CO2|strategy-pack;chemistry
science|Chemistry|800|standard||This chemical process transfers electrons between species and includes oxidation.|Redox reaction|oxidation-reduction reaction|strategy-pack;chemistry
science|Physics|200|standard||Named for James Prescott, this SI unit measures energy.|Joule||strategy-pack;physics
science|Physics|600|standard||This law says pressure and volume of a gas vary inversely at constant temperature.|Boyle's law|Boyle law|strategy-pack;physics
science|Physics|1000|standard||This observed shift changes wavelength when a source moves toward or away from an observer.|Doppler effect|Doppler shift|strategy-pack;physics
science|Astronomy & Space|200|standard||This planet has the Great Red Spot and the largest mass in the Solar System.|Jupiter||strategy-pack;space
science|Astronomy & Space|600|standard||This moon of Jupiter has a subsurface ocean and an icy crust.|Europa||strategy-pack;space
science|Earth Science|400|standard||This boundary marks where two tectonic plates slide past each other horizontally.|Transform fault|transform boundary|strategy-pack;earth-science
science|Earth Science|800|standard||This scale measures tornado intensity from EF0 to EF5.|Enhanced Fujita scale|EF scale|strategy-pack;earth-science
science|Medicine & Anatomy|200|standard||This blood protein carries oxygen with the help of iron.|Hemoglobin|haemoglobin|strategy-pack;anatomy
science|Medicine & Anatomy|600|standard||This pair of bean-shaped organs filters blood and produces urine.|Kidneys|kidney|strategy-pack;anatomy
science|Animals & Plants|400|standard||This marine mammal uses echolocation and includes orcas among its largest members.|Dolphin|dolphins|strategy-pack;animals
science|Inventions & Discoveries|800|standard||This scientist's 1928 observation of mold killing bacteria led to penicillin.|Alexander Fleming|Fleming|strategy-pack;discoveries
science|Scientists|400|standard||This primatologist studied chimpanzees at Gombe Stream in Tanzania.|Jane Goodall|Goodall|strategy-pack;scientists
science|Scientists|1000|standard||This mathematician and physicist wrote A Brief History of Time while studying black holes.|Stephen Hawking|Hawking|strategy-pack;scientists
science|Units, Laws & Constants|800|standard||This quantity relates photon energy to frequency in quantum physics.|Planck's constant|Planck constant|strategy-pack;constants
arts_visual_culture|Painters & Sculptors|200|standard||This Mexican artist painted many self-portraits with symbolic animals and plants.|Frida Kahlo|Kahlo|strategy-pack;painters
arts_visual_culture|Painters & Sculptors|400|standard||This French sculptor created The Thinker as part of a larger Gates of Hell project.|Auguste Rodin|Rodin|strategy-pack;sculpture
arts_visual_culture|Painters & Sculptors|800|standard||This American painter used drip techniques in works like Autumn Rhythm.|Jackson Pollock|Pollock|strategy-pack;painters
arts_visual_culture|Famous Artworks|200|standard||This painting by Edvard Munch shows a figure under a swirling orange sky.|The Scream|Scream|strategy-pack;artworks
arts_visual_culture|Famous Artworks|600|standard||This Picasso mural responded to the bombing of a Basque town during the Spanish Civil War.|Guernica||strategy-pack;artworks
arts_visual_culture|Famous Artworks|1000|standard||This Diego Velazquez painting shows the Infanta Margarita surrounded by attendants.|Las Meninas|The Maids of Honour|strategy-pack;artworks
arts_visual_culture|Art Movements|400|standard||This movement by Picasso and Braque broke subjects into geometric planes.|Cubism|Cubist movement|strategy-pack;movements
arts_visual_culture|Art Movements|800|standard||This movement associated with Marcel Duchamp embraced absurdity after World War I.|Dada|Dadaism|strategy-pack;movements
arts_visual_culture|Architecture|200|standard||This Roman building with a giant dome includes an oculus open to the sky.|Pantheon|the Pantheon|strategy-pack;architecture
arts_visual_culture|Architecture|600|standard||This architect designed the glass pyramid outside the Louvre.|I. M. Pei|Ieoh Ming Pei|strategy-pack;architecture
arts_visual_culture|Museums & Collections|400|standard||This Smithsonian institution houses the Hope Diamond and many fossil displays.|National Museum of Natural History|Smithsonian Natural History Museum|strategy-pack;museums
arts_visual_culture|Museums & Collections|1000|standard||This Madrid museum is known for a collection including Bosch, Velazquez, and Goya.|Prado Museum|Museo del Prado;Prado|strategy-pack;museums
arts_visual_culture|Photography|200|standard||This Depression-era photograph by Dorothea Lange shows Florence Owens Thompson.|Migrant Mother||strategy-pack;photography
arts_visual_culture|Photography|800|standard||This photographer of Moonrise, Hernandez helped make Yosemite a black-and-white icon.|Ansel Adams|Adams|strategy-pack;photography
arts_visual_culture|Design & Decorative Arts|400|standard||This German school founded by Walter Gropius joined art, craft, and architecture.|Bauhaus|the Bauhaus|strategy-pack;design
arts_visual_culture|Design & Decorative Arts|600|standard||This style used flowing plant forms and helped shape posters by Alphonse Mucha.|Art Nouveau||strategy-pack;design
arts_visual_culture|Public Art & Monuments|200|standard||This polished black wall in Washington lists names of U.S. service members lost in Southeast Asia.|Vietnam Veterans Memorial|the Vietnam Veterans Memorial|strategy-pack;monuments
arts_visual_culture|Public Art & Monuments|1000|standard||This Chicago sculpture by Anish Kapoor reflects the skyline in Millennium Park.|Cloud Gate|The Bean|strategy-pack;monuments
arts_visual_culture|Art Terms & Techniques|600|standard||This painting technique uses strong contrasts of light and dark for dramatic effect.|Chiaroscuro||strategy-pack;technique
arts_visual_culture|Patrons, Critics & Schools|800|standard||This critic championed abstract expressionism and the idea of flatness in modern painting.|Clement Greenberg|Greenberg|strategy-pack;criticism
music_performing_arts|Classical Composers|200|standard||This composer wrote The Four Seasons as a set of violin concertos.|Antonio Vivaldi|Vivaldi|strategy-pack;classical
music_performing_arts|Classical Composers|400|standard||This composer of The Rite of Spring caused a famous 1913 Paris uproar.|Igor Stravinsky|Stravinsky|strategy-pack;classical
music_performing_arts|Classical Composers|800|standard||This Finnish composer wrote Finlandia and seven numbered symphonies.|Jean Sibelius|Sibelius|strategy-pack;classical
music_performing_arts|Opera|200|standard||This Puccini opera features the aria Nessun dorma.|Turandot||strategy-pack;opera
music_performing_arts|Opera|600|standard||This Verdi opera about an Ethiopian princess includes a triumphal march.|Aida||strategy-pack;opera
music_performing_arts|Broadway & Musicals|200|standard||This musical about the first Treasury secretary uses hip-hop to tell early U.S. history.|Hamilton||strategy-pack;broadway
music_performing_arts|Broadway & Musicals|400|standard||This Sondheim show sends fairy-tale characters beyond happy endings after Act I.|Into the Woods|Into The Woods|strategy-pack;broadway
music_performing_arts|Broadway & Musicals|1000|standard||This Kander and Ebb musical is set in a Berlin nightclub as Weimar Germany collapses.|Cabaret||strategy-pack;broadway
music_performing_arts|Popular Music|200|standard||This British band released Abbey Road and Sgt. Pepper's Lonely Hearts Club Band.|The Beatles|Beatles|strategy-pack;popular-music
music_performing_arts|Popular Music|600|standard||This singer's album Purple Rain doubled as a film soundtrack.|Prince||strategy-pack;popular-music
music_performing_arts|Jazz & Blues|400|standard||This New Orleans trumpeter helped popularize jazz singing and improvisation.|Louis Armstrong|Armstrong;Satchmo|strategy-pack;jazz
music_performing_arts|Jazz & Blues|800|standard||This saxophonist recorded A Love Supreme with his classic quartet.|John Coltrane|Coltrane|strategy-pack;jazz
music_performing_arts|Instruments|200|standard||This large brass instrument often wraps around the player's body and plays low notes.|Tuba||strategy-pack;instruments
music_performing_arts|Instruments|600|standard||This double-reed woodwind tunes orchestras with an A before concerts.|Oboe||strategy-pack;instruments
music_performing_arts|Music Theory & Terms|400|standard||This term names the speed of a piece of music.|Tempo||strategy-pack;theory
music_performing_arts|Music Theory & Terms|1000|standard||This interval spans eight diatonic scale degrees from one note to its namesake higher note.|Octave||strategy-pack;theory
music_performing_arts|Dance|400|standard||This Argentine dance is known for close embrace and sharp leg movements.|Tango||strategy-pack;dance
music_performing_arts|Theater|600|standard||This Japanese theater form uses masks, slow movement, and a chorus.|Noh|Nō|strategy-pack;theater
music_performing_arts|Film Scores & Soundtracks|800|standard||This composer scored Jaws, Star Wars, E.T., and Jurassic Park.|John Williams|Williams|strategy-pack;soundtracks
music_performing_arts|Film Scores & Soundtracks|1000|standard||This Italian composer scored The Good, the Bad and the Ugly and Cinema Paradiso.|Ennio Morricone|Morricone|strategy-pack;soundtracks
religion_mythology_philosophy|Greek Mythology|200|standard||This god ruled the underworld and carried off Persephone.|Hades||strategy-pack;greek-myth
religion_mythology_philosophy|Greek Mythology|600|standard||This craftsman built wings for himself and his son to escape Crete.|Daedalus||strategy-pack;greek-myth
religion_mythology_philosophy|Roman & Norse Mythology|400|standard||This Norse god loses a hand when the wolf Fenrir is bound.|Tyr|Týr|strategy-pack;norse
religion_mythology_philosophy|Roman & Norse Mythology|800|standard||This Norse hall receives warriors chosen by Odin's Valkyries.|Valhalla||strategy-pack;norse
religion_mythology_philosophy|World Mythology|200|standard||This Egyptian god of the sun was often represented with a falcon head.|Ra|Re|strategy-pack;egyptian-myth
religion_mythology_philosophy|World Mythology|600|standard||This Aztec feathered serpent deity has a name meaning precious serpent.|Quetzalcoatl||strategy-pack;mesoamerican
religion_mythology_philosophy|Bible|200|standard||This man built an ark before a flood covered the earth.|Noah||strategy-pack;bible
religion_mythology_philosophy|Bible|400|standard||This woman from Moab says where you go, I will go, to Naomi.|Ruth||strategy-pack;bible
religion_mythology_philosophy|Bible|1000|standard||This minor prophet is associated with a valley of dry bones in a vision of restoration.|Ezekiel||strategy-pack;bible
religion_mythology_philosophy|World Religions|200|standard||This faith's sacred river Ganges is central to pilgrimage and purification.|Hinduism||strategy-pack;religion
religion_mythology_philosophy|World Religions|600|standard||This religion founded in Punjab uses the Guru Granth Sahib as scripture.|Sikhism||strategy-pack;religion
religion_mythology_philosophy|Religious Texts & Terms|400|standard||This Sanskrit term for action and consequence is central in Indian religions.|Karma||strategy-pack;religious-terms
religion_mythology_philosophy|Religious Texts & Terms|800|standard||This Jewish mystical tradition includes the Zohar as a central text.|Kabbalah|Cabala;Qabalah|strategy-pack;religious-terms
religion_mythology_philosophy|Philosophers|200|standard||This Chinese teacher is associated with Analects and filial piety.|Confucius|Kongzi|strategy-pack;philosophy
religion_mythology_philosophy|Philosophers|600|standard||This philosopher wrote The Second Sex and helped shape existential feminism.|Simone de Beauvoir|Beauvoir|strategy-pack;philosophy
religion_mythology_philosophy|Philosophical Schools|400|standard||This school associated with Pyrrho suspends judgment because certainty is difficult.|Skepticism|Scepticism|strategy-pack;philosophy
religion_mythology_philosophy|Philosophical Schools|1000|standard||This school of Indian philosophy is classically dualist and paired with Yoga.|Samkhya|Sankhya|strategy-pack;philosophy
religion_mythology_philosophy|Ethics & Political Thought|800|standard||This Kantian command asks people to act only by principles they could will as universal law.|Categorical imperative|the categorical imperative|strategy-pack;ethics
religion_mythology_philosophy|Symbols, Rituals & Holidays|400|standard||This Islamic month of fasting ends with Eid al-Fitr.|Ramadan||strategy-pack;religion
religion_mythology_philosophy|Symbols, Rituals & Holidays|1000|standard||This Jewish Day of Atonement is marked by fasting and confession.|Yom Kippur||strategy-pack;religion
language_wordplay|Definitions|200|standard||This adjective means able to use both hands skillfully.|Ambidextrous||strategy-pack;definitions
language_wordplay|Definitions|600|standard||This noun means a confused mixture or jumble, especially of ideas or words.|Hodgepodge|hotchpotch|strategy-pack;definitions
language_wordplay|Definitions|1000|standard||This adjective means stubbornly refusing to change an opinion.|Obdurate||strategy-pack;definitions
language_wordplay|Etymology|400|standard||This word for a fellow traveler or dining partner comes from Latin roots meaning with bread.|Companion||strategy-pack;etymology
language_wordplay|Etymology|800|standard||This word for a farewell comes from a contraction of God be with ye.|Goodbye|good-bye|strategy-pack;etymology
language_wordplay|Homophones & Soundalikes|200|standard||This homophone of flour names the colorful part of a plant.|Flower||strategy-pack;homophones
language_wordplay|Homophones & Soundalikes|400|standard||This homophone of waist means to spend carelessly or use up.|Waste||strategy-pack;homophones
language_wordplay|Anagrams|400|anagram|anagram of RESCUE|Rearrange RESCUE to name a word meaning make safe or fasten.|Secure||strategy-pack;anagram
language_wordplay|Anagrams|600|anagram|anagram of MASTER|Rearrange MASTER to name a small flowing body of water.|Stream||strategy-pack;anagram
language_wordplay|Anagrams|1000|anagram|anagram of INTEGRAL|Rearrange INTEGRAL to name a three-sided geometric figure.|Triangle||strategy-pack;anagram
language_wordplay|Before & After|200|before_after||Wizard of Oz road + famous Beatles album.|Yellow Brick Road Abbey Road|Yellow Brick Road Abbey Road|strategy-pack;before-after
language_wordplay|Before & After|600|before_after||Greek hero with a heel + Brad Pitt film set in ancient Troy.|Achilles Troy|Achilles Troy|strategy-pack;before-after
language_wordplay|Before & After|800|before_after||Fitzgerald millionaire + Batman's home city.|Great Gatsby Gotham|The Great Gatsby Gotham|strategy-pack;before-after
language_wordplay|Initials & Abbreviations|200|standard||In internet addresses, this three-letter abbreviation commonly begins a web URL.|WWW|World Wide Web|strategy-pack;abbreviations
language_wordplay|Initials & Abbreviations|600|standard||This Latin abbreviation means and the rest.|Et cetera|etc.;etcetera|strategy-pack;abbreviations
language_wordplay|Foreign Words & Phrases|400|standard||This Spanish phrase literally means until the sight and is used as goodbye.|Hasta la vista||strategy-pack;foreign-phrases
language_wordplay|Foreign Words & Phrases|800|standard||This German word names a spirit of the age.|Zeitgeist||strategy-pack;foreign-phrases
language_wordplay|Grammar & Usage|400|standard||This punctuation mark joins independent clauses more strongly than a comma.|Semicolon||strategy-pack;grammar
language_wordplay|Rhymes & Word Ladders|600|rhyme_time||In Rhyme Time, this phrase could mean a speedy baby bird.|Quick chick||strategy-pack;rhyme-time
language_wordplay|Puns, Quotes & Idioms|800|standard||In this idiom, revealing a secret is letting the cat out of this.|Bag||strategy-pack;idioms
sports_games_leisure|Baseball|200|standard||This team plays home games at Fenway Park.|Boston Red Sox|Red Sox|strategy-pack;baseball
sports_games_leisure|Baseball|600|standard||In baseball, this three-letter statistic credits a batter when a plate appearance drives home a run.|RBI|runs batted in|strategy-pack;baseball
sports_games_leisure|Baseball|1000|standard||This pitcher threw a perfect game in the 1956 World Series.|Don Larsen|Larsen|strategy-pack;baseball
sports_games_leisure|Football|200|standard||This NFL team plays home games at Lambeau Field.|Green Bay Packers|Packers|strategy-pack;football
sports_games_leisure|Football|400|standard||This position usually snaps the ball to the quarterback.|Center|centre|strategy-pack;football
sports_games_leisure|Basketball|200|standard||This NBA team won six championships with Michael Jordan in the 1990s.|Chicago Bulls|Bulls|strategy-pack;basketball
sports_games_leisure|Basketball|800|standard||This coach led UCLA men's basketball to ten NCAA championships.|John Wooden|Wooden|strategy-pack;basketball
sports_games_leisure|Soccer|400|standard||This international tournament awards a trophy every four years to a national team champion.|FIFA World Cup|World Cup|strategy-pack;soccer
sports_games_leisure|Soccer|1000|standard||This Brazilian forward was born Edson Arantes do Nascimento.|Pele|Pelé|strategy-pack;soccer
sports_games_leisure|Tennis & Golf|200|standard||This tennis tournament is played on grass at the All England Club.|Wimbledon||strategy-pack;tennis
sports_games_leisure|Tennis & Golf|600|standard||This golfer was nicknamed the Golden Bear.|Jack Nicklaus|Nicklaus|strategy-pack;golf
sports_games_leisure|Olympics|400|standard||This city hosted the first modern Olympic Games in 1896.|Athens||strategy-pack;olympics
sports_games_leisure|Olympics|800|standard||This track athlete won four gold medals at the 1936 Berlin Olympics.|Jesse Owens|Owens|strategy-pack;olympics
sports_games_leisure|Sports Records & Awards|600|standard||This baseball award honors each league's top pitcher.|Cy Young Award|Cy Young|strategy-pack;sports-awards
sports_games_leisure|Sports Records & Awards|1000|standard||This soccer award from France Football honors the world's top player.|Ballon d'Or|Ballon d Or|strategy-pack;sports-awards
sports_games_leisure|Rules & Terminology|400|standard||In tennis scoring, this word means a tied score after both players reach forty.|Deuce||strategy-pack;rules
sports_games_leisure|Rules & Terminology|800|standard||In chess, this move protects the king by moving it two squares toward a rook.|Castling||strategy-pack;rules
sports_games_leisure|Board Games & Card Games|200|standard||This board game uses properties like Boardwalk, Park Place, and railroads.|Monopoly||strategy-pack;board-games
sports_games_leisure|Board Games & Card Games|600|standard||This card game's name comes from a Spanish word for basket.|Canasta||strategy-pack;card-games
sports_games_leisure|Video Games & Esports|800|standard||This Nintendo franchise centers on Samus Aran and alien parasites.|Metroid||strategy-pack;video-games
pop_culture_media_modern_life|Film|200|standard||This 1982 Spielberg film follows a stranded alien who wants to phone home.|E.T. the Extra-Terrestrial|E.T.;ET|strategy-pack;film
pop_culture_media_modern_life|Film|400|standard||This 1975 shark thriller made Steven Spielberg a blockbuster director.|Jaws||strategy-pack;film
pop_culture_media_modern_life|Film|800|standard||This Japanese director made Seven Samurai and Rashomon.|Akira Kurosawa|Kurosawa|strategy-pack;film
pop_culture_media_modern_life|Television|200|standard||This sitcom featured Central Perk and characters named Rachel, Ross, Monica, Chandler, Joey, and Phoebe.|Friends||strategy-pack;television
pop_culture_media_modern_life|Television|600|standard||This HBO drama follows Tony Soprano and his New Jersey crime family.|The Sopranos|Sopranos|strategy-pack;television
pop_culture_media_modern_life|Streaming & Internet Culture|400|standard||This Google-owned video platform launched in 2005.|YouTube||strategy-pack;internet
pop_culture_media_modern_life|Streaming & Internet Culture|1000|standard||This term names a small image or video spread rapidly online with variations.|Meme|internet meme|strategy-pack;internet
pop_culture_media_modern_life|Comics & Graphic Novels|200|standard||This Kryptonian superhero works at the Daily Planet when not wearing a cape.|Superman|Clark Kent|strategy-pack;comics
pop_culture_media_modern_life|Comics & Graphic Novels|600|standard||This graphic novel by Art Spiegelman portrays the Holocaust with animal-headed characters.|Maus||strategy-pack;comics
pop_culture_media_modern_life|Celebrities & Public Figures|400|standard||This host turned a daytime talk show into a media empire and book club.|Oprah Winfrey|Oprah|strategy-pack;public-figures
pop_culture_media_modern_life|Celebrities & Public Figures|800|standard||This chef and travel host wrote Kitchen Confidential.|Anthony Bourdain|Bourdain|strategy-pack;public-figures
pop_culture_media_modern_life|Brands & Advertising|200|standard||This athletic brand's swoosh logo was designed by Carolyn Davidson.|Nike||strategy-pack;brands
pop_culture_media_modern_life|Brands & Advertising|600|standard||This fast-food chain uses the slogan Have It Your Way.|Burger King||strategy-pack;brands
pop_culture_media_modern_life|Food & Drink|400|standard||This Italian dessert layers coffee-soaked ladyfingers with mascarpone.|Tiramisu||strategy-pack;food
pop_culture_media_modern_life|Food & Drink|1000|standard||This fermented Korean cabbage dish is commonly seasoned with chili and garlic.|Kimchi||strategy-pack;food
pop_culture_media_modern_life|Fashion & Lifestyle|400|standard||This French fashion house is associated with the interlocking CC logo.|Chanel||strategy-pack;fashion
pop_culture_media_modern_life|Technology & Companies|200|standard||This company created the iPhone and Macintosh computer.|Apple||strategy-pack;technology
pop_culture_media_modern_life|Technology & Companies|600|standard||This database language uses SELECT, FROM, and WHERE clauses.|SQL|Structured Query Language|strategy-pack;technology
pop_culture_media_modern_life|Recent Events & Current Affairs|800|standard||This 2020 global public health crisis was caused by the SARS-CoV-2 virus.|COVID-19 pandemic|COVID pandemic;coronavirus pandemic|strategy-pack;current-affairs
pop_culture_media_modern_life|Technology & Companies|1000|standard||This British computer scientist proposed the World Wide Web while at CERN.|Tim Berners-Lee|Berners-Lee|strategy-pack;technology
`;

const questions = parseRows(rows).map((row, index) => {
  const externalHash = crypto
    .createHash('sha1')
    .update(`original_strategy_pack|${label}|${String(index + 1).padStart(3, '0')}`)
    .digest('hex')
    .slice(0, 10);

  return {
    source: 'original_strategy_pack',
    source_url: null,
    source_license: 'original',
    external_id: `${label}-${String(index + 1).padStart(3, '0')}-${externalHash}`,
    category_id: row.category_id,
    subcategory_name: row.subcategory_name,
    value: row.value,
    difficulty_rank: rankByValue[row.value],
    mechanic: row.mechanic,
    constraint_text: row.constraint_text,
    clue: row.clue,
    answer: row.answer,
    aliases: row.aliases,
    distractors: [],
    tags: [...new Set(['strategy-pack', ...row.tags])],
    review_status: 'ready',
  };
});

await fs.mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${label}.json`);
await fs.writeFile(outputPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  provider: 'original_strategy_pack',
  notes: [
    'Original balanced 200-question pack created after J! Archive difficulty calibration.',
    'Designed to exercise the shared intake quality, feedback, and difficulty rules.',
  ],
  questions,
}, null, 2));

console.log(`Wrote ${outputPath}`);
console.log(`Generated ${questions.length} questions.`);
console.log(JSON.stringify(countByCategory(questions), null, 2));

function parseRows(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split('|');
      if (parts.length !== 9) throw new Error(`Line ${index + 1} has ${parts.length} columns.`);
      const [category_id, subcategory_name, valueText, mechanic, constraintText, clue, answer, aliasesText, tagsText] = parts.map((part) => part.trim());
      return {
        category_id,
        subcategory_name,
        value: Number(valueText),
        mechanic,
        constraint_text: constraintText || null,
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
