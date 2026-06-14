const QUESTIONS = [
  {
    id: "geo-capitals-001",
    category: "Geography",
    subcategory: "World Capitals",
    value: 200,
    difficulty_rank: 1,
    mechanic: "standard",
    clue: "This city on the Tiber is the capital of Italy.",
    answer: "Rome",
    tags: ["geography", "capitals"]
  },
  {
    id: "geo-capitals-002",
    category: "Geography",
    subcategory: "World Capitals",
    value: 400,
    difficulty_rank: 2,
    mechanic: "crossword_clue",
    constraint: "S",
    clue: "Capital of Chile.",
    answer: "Santiago",
    tags: ["geography", "capitals", "crossword"]
  },
  {
    id: "geo-rivers-001",
    category: "Geography",
    subcategory: "Rivers, Lakes & Seas",
    value: 600,
    difficulty_rank: 3,
    mechanic: "standard",
    clue: "This river flows through Vienna, Budapest, and Belgrade before reaching the Black Sea.",
    answer: "Danube",
    tags: ["geography", "rivers", "europe"]
  },
  {
    id: "geo-borders-001",
    category: "Geography",
    subcategory: "Countries & Borders",
    value: 800,
    difficulty_rank: 4,
    mechanic: "starts_with",
    constraint: "ER",
    clue: "Starting with 'Er', this East African country has a Red Sea coastline and capital at Asmara.",
    answer: "Eritrea",
    tags: ["geography", "africa", "starts-with"]
  },
  {
    id: "lit-authors-001",
    category: "Literature & Books",
    subcategory: "Authors & Works",
    value: 200,
    difficulty_rank: 1,
    mechanic: "standard",
    clue: "This English author wrote 'Pride and Prejudice'.",
    answer: "Jane Austen",
    tags: ["literature", "authors"]
  },
  {
    id: "lit-19c-001",
    category: "Literature & Books",
    subcategory: "19th-Century Novels",
    value: 400,
    difficulty_rank: 2,
    mechanic: "standard",
    clue: "This 1866 Dostoevsky novel follows Raskolnikov after the murder of a pawnbroker.",
    answer: "Crime and Punishment",
    tags: ["literature", "russian-literature"]
  },
  {
    id: "lit-before-after-001",
    category: "Literature & Books",
    subcategory: "Literary Characters",
    value: 600,
    difficulty_rank: 3,
    mechanic: "before_after",
    clue: "Dickens orphan who asks for more + the dance made famous by Chubby Checker.",
    answer: "Oliver Twist",
    tags: ["literature", "before-after"]
  },
  {
    id: "history-presidents-001",
    category: "History",
    subcategory: "U.S. Presidents & Elections",
    value: 200,
    difficulty_rank: 1,
    mechanic: "standard",
    clue: "This president issued the Emancipation Proclamation in 1863.",
    answer: "Abraham Lincoln",
    tags: ["history", "presidents"]
  },
  {
    id: "history-treaties-001",
    category: "History",
    subcategory: "Dates, Documents & Treaties",
    value: 600,
    difficulty_rank: 3,
    mechanic: "standard",
    clue: "This 1919 treaty formally ended World War I between Germany and the Allied powers.",
    answer: "Treaty of Versailles",
    tags: ["history", "world-wars", "treaties"]
  },
  {
    id: "history-ancient-001",
    category: "History",
    subcategory: "Ancient History",
    value: 800,
    difficulty_rank: 4,
    mechanic: "contains",
    constraint: "X",
    clue: "Containing 'x', this Persian king fought the Greeks at Thermopylae.",
    answer: "Xerxes",
    tags: ["history", "ancient", "contains"]
  },
  {
    id: "science-chem-001",
    category: "Science",
    subcategory: "Chemistry",
    value: 200,
    difficulty_rank: 1,
    mechanic: "standard",
    clue: "This chemical element has the symbol O.",
    answer: "Oxygen",
    tags: ["science", "chemistry", "elements"]
  },
  {
    id: "science-space-001",
    category: "Science",
    subcategory: "Astronomy & Space",
    value: 400,
    difficulty_rank: 2,
    mechanic: "standard",
    clue: "This largest moon of Saturn has a thick atmosphere and methane lakes.",
    answer: "Titan",
    tags: ["science", "space"]
  },
  {
    id: "science-anatomy-001",
    category: "Science",
    subcategory: "Medicine & Anatomy",
    value: 200,
    difficulty_rank: 1,
    mechanic: "starts_with",
    constraint: "ER",
    clue: "Starting with 'ER', this hospital department handles acute emergencies.",
    answer: "ER",
    tags: ["science", "medicine", "starts-with"]
  },
  {
    id: "art-painters-001",
    category: "Arts & Visual Culture",
    subcategory: "Painters & Sculptors",
    value: 200,
    difficulty_rank: 1,
    mechanic: "standard",
    clue: "This Dutch painter created 'The Starry Night'.",
    answer: "Vincent van Gogh",
    tags: ["art", "painters"]
  },
  {
    id: "art-architecture-001",
    category: "Arts & Visual Culture",
    subcategory: "Architecture",
    value: 600,
    difficulty_rank: 3,
    mechanic: "standard",
    clue: "This architect designed Fallingwater, a Pennsylvania house built partly over a waterfall.",
    answer: "Frank Lloyd Wright",
    tags: ["art", "architecture"]
  },
  {
    id: "music-classical-001",
    category: "Music & Performing Arts",
    subcategory: "Classical Composers",
    value: 200,
    difficulty_rank: 1,
    mechanic: "standard",
    clue: "This German composer wrote the Ninth Symphony and its 'Ode to Joy' finale.",
    answer: "Ludwig van Beethoven",
    tags: ["music", "classical"]
  },
  {
    id: "music-broadway-001",
    category: "Music & Performing Arts",
    subcategory: "Broadway & Musicals",
    value: 400,
    difficulty_rank: 2,
    mechanic: "standard",
    clue: "The songs 'My Shot' and 'The Room Where It Happens' come from this Lin-Manuel Miranda musical.",
    answer: "Hamilton",
    tags: ["music", "broadway"]
  },
  {
    id: "myth-greek-001",
    category: "Religion, Mythology & Philosophy",
    subcategory: "Greek Mythology",
    value: 200,
    difficulty_rank: 1,
    mechanic: "standard",
    clue: "This Greek god of the sea carried a trident.",
    answer: "Poseidon",
    tags: ["mythology", "greek"]
  },
  {
    id: "phil-philosophers-001",
    category: "Religion, Mythology & Philosophy",
    subcategory: "Philosophers",
    value: 600,
    difficulty_rank: 3,
    mechanic: "standard",
    clue: "This German philosopher wrote 'Critique of Pure Reason'.",
    answer: "Immanuel Kant",
    tags: ["philosophy"]
  },
  {
    id: "word-etymology-001",
    category: "Language & Wordplay",
    subcategory: "Etymology",
    value: 400,
    difficulty_rank: 2,
    mechanic: "standard",
    clue: "From Greek roots meaning 'far' and 'sound', this word names a device used for distant speech.",
    answer: "Telephone",
    tags: ["language", "etymology"]
  },
  {
    id: "word-crossword-001",
    category: "Language & Wordplay",
    subcategory: "Definitions",
    value: 200,
    difficulty_rank: 1,
    mechanic: "crossword_clue",
    constraint: "S",
    clue: "Large body of salt water.",
    answer: "Sea",
    tags: ["language", "crossword"]
  },
  {
    id: "sports-olympics-001",
    category: "Sports, Games & Leisure",
    subcategory: "Olympics",
    value: 400,
    difficulty_rank: 2,
    mechanic: "standard",
    clue: "This city hosted the 1992 Summer Olympics and later became associated with a Dream Team.",
    answer: "Barcelona",
    tags: ["sports", "olympics"]
  },
  {
    id: "sports-games-001",
    category: "Sports, Games & Leisure",
    subcategory: "Board Games & Card Games",
    value: 600,
    difficulty_rank: 3,
    mechanic: "standard",
    clue: "In chess notation, this letter identifies the knight.",
    answer: "N",
    tags: ["games", "chess"]
  },
  {
    id: "pop-film-001",
    category: "Pop Culture, Media & Modern Life",
    subcategory: "Film",
    value: 200,
    difficulty_rank: 1,
    mechanic: "standard",
    clue: "This 1997 James Cameron film features Jack, Rose, and a doomed ocean liner.",
    answer: "Titanic",
    tags: ["film"]
  },
  {
    id: "pop-tech-001",
    category: "Pop Culture, Media & Modern Life",
    subcategory: "Technology & Companies",
    value: 400,
    difficulty_rank: 2,
    mechanic: "standard",
    clue: "This company introduced the iPhone in 2007.",
    answer: "Apple",
    tags: ["technology", "companies"]
  },
  {
    id: "pop-food-001",
    category: "Pop Culture, Media & Modern Life",
    subcategory: "Food & Drink",
    value: 600,
    difficulty_rank: 3,
    mechanic: "ends_with",
    constraint: "O",
    clue: "Ending with 'o', this Italian rice dish is stirred with broth until creamy.",
    answer: "Risotto",
    tags: ["food", "ends-with"]
  }
];

const state = {
  view: "practice",
  currentSet: [],
  currentIndex: 0,
  revealed: false,
  sessionScore: 0,
  recent: [],
  results: JSON.parse(localStorage.getItem("tt_results") || "[]"),
  misses: JSON.parse(localStorage.getItem("tt_misses") || "[]")
};

const el = {
  categoryFilter: document.getElementById("category-filter"),
  subcategoryFilter: document.getElementById("subcategory-filter"),
  valueFilter: document.getElementById("value-filter"),
  mechanicFilter: document.getElementById("mechanic-filter"),
  startSession: document.getElementById("start-session"),
  viewLabel: document.getElementById("view-label"),
  screenTitle: document.getElementById("screen-title"),
  sessionCount: document.getElementById("session-count"),
  sessionScore: document.getElementById("session-score"),
  clueCategory: document.getElementById("clue-category"),
  clueSubcategory: document.getElementById("clue-subcategory"),
  clueValue: document.getElementById("clue-value"),
  clueMechanic: document.getElementById("clue-mechanic"),
  clueText: document.getElementById("clue-text"),
  answerInput: document.getElementById("answer-input"),
  revealAnswer: document.getElementById("reveal-answer"),
  answerDisplay: document.getElementById("answer-display"),
  gradeControls: document.getElementById("grade-controls"),
  recentResults: document.getElementById("recent-results"),
  missList: document.getElementById("miss-list"),
  clearMisses: document.getElementById("clear-misses"),
  statAttempts: document.getElementById("stat-attempts"),
  statAccuracy: document.getElementById("stat-accuracy"),
  statClose: document.getElementById("stat-close"),
  statMisses: document.getElementById("stat-misses"),
  categoryStats: document.getElementById("category-stats"),
  buildChallenge: document.getElementById("build-challenge"),
  copyChallenge: document.getElementById("copy-challenge"),
  challengeCode: document.getElementById("challenge-code")
};

function unique(values) {
  return Array.from(new Set(values)).sort();
}

function option(select, value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  select.appendChild(node);
}

function populateFilters() {
  option(el.categoryFilter, "all", "All categories");
  unique(QUESTIONS.map((q) => q.category)).forEach((value) => option(el.categoryFilter, value, value));

  option(el.valueFilter, "all", "All values");
  [200, 400, 600, 800, 1000].forEach((value) => option(el.valueFilter, String(value), `$${value}`));

  option(el.mechanicFilter, "all", "All mechanics");
  unique(QUESTIONS.map((q) => q.mechanic)).forEach((value) => option(el.mechanicFilter, value, labelMechanic(value)));

  refreshSubcategories();
}

function refreshSubcategories() {
  const current = el.subcategoryFilter.value;
  el.subcategoryFilter.innerHTML = "";
  option(el.subcategoryFilter, "all", "All subcategories");
  const category = el.categoryFilter.value;
  const source = category === "all" ? QUESTIONS : QUESTIONS.filter((q) => q.category === category);
  unique(source.map((q) => q.subcategory)).forEach((value) => option(el.subcategoryFilter, value, value));
  el.subcategoryFilter.value = Array.from(el.subcategoryFilter.options).some((o) => o.value === current) ? current : "all";
}

function labelMechanic(value) {
  return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function filteredQuestions() {
  return QUESTIONS.filter((q) => {
    return (el.categoryFilter.value === "all" || q.category === el.categoryFilter.value)
      && (el.subcategoryFilter.value === "all" || q.subcategory === el.subcategoryFilter.value)
      && (el.valueFilter.value === "all" || String(q.value) === el.valueFilter.value)
      && (el.mechanicFilter.value === "all" || q.mechanic === el.mechanicFilter.value);
  });
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function startSession() {
  state.currentSet = shuffle(filteredQuestions()).slice(0, 12);
  state.currentIndex = 0;
  state.revealed = false;
  state.sessionScore = 0;
  state.recent = [];
  renderPractice();
  renderRecent();
}

function currentQuestion() {
  return state.currentSet[state.currentIndex];
}

function mechanicText(question) {
  if (!question) return "";
  const label = labelMechanic(question.mechanic);
  return question.constraint ? `${label}: ${question.constraint}` : label;
}

function renderPractice() {
  const question = currentQuestion();
  el.sessionCount.textContent = `${Math.min(state.currentIndex + 1, state.currentSet.length)} / ${state.currentSet.length}`;
  el.sessionScore.textContent = `$${state.sessionScore}`;
  el.answerInput.value = "";
  el.answerDisplay.textContent = "";
  el.gradeControls.hidden = true;
  state.revealed = false;

  if (!question) {
    el.clueCategory.textContent = "No set";
    el.clueSubcategory.textContent = "Adjust filters";
    el.clueValue.textContent = "$0";
    el.clueMechanic.textContent = "";
    el.clueText.textContent = state.currentSet.length === 0 ? "No questions match those filters." : "Set complete. Start another one when ready.";
    return;
  }

  el.clueCategory.textContent = question.category;
  el.clueSubcategory.textContent = question.subcategory;
  el.clueValue.textContent = `$${question.value}`;
  el.clueMechanic.textContent = question.mechanic === "standard" ? "" : mechanicText(question);
  el.clueText.textContent = question.clue;
  el.answerInput.focus();
}

function revealAnswer() {
  const question = currentQuestion();
  if (!question) return;
  state.revealed = true;
  el.answerDisplay.textContent = question.answer;
  el.gradeControls.hidden = false;
}

function gradeCurrent(grade) {
  const question = currentQuestion();
  if (!question) return;
  const response = el.answerInput.value.trim();
  const result = {
    id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    question_id: question.id,
    category: question.category,
    subcategory: question.subcategory,
    value: question.value,
    mechanic: question.mechanic,
    clue: question.clue,
    answer: question.answer,
    response,
    grade,
    created_at: new Date().toISOString()
  };

  state.results.push(result);
  localStorage.setItem("tt_results", JSON.stringify(state.results));

  if (grade === "correct") state.sessionScore += question.value;
  if (grade === "missed" || grade === "unknown") {
    state.misses.unshift(result);
    state.misses = state.misses.slice(0, 100);
    localStorage.setItem("tt_misses", JSON.stringify(state.misses));
  }

  state.recent.unshift(result);
  state.recent = state.recent.slice(0, 8);
  state.currentIndex += 1;
  renderRecent();
  renderStats();
  renderMisses();
  renderPractice();
}

function renderRecent() {
  el.recentResults.innerHTML = "";
  state.recent.forEach((result) => {
    const node = document.createElement("li");
    node.textContent = `${result.grade.toUpperCase()} - ${result.category} / ${result.subcategory} - ${result.answer}`;
    el.recentResults.appendChild(node);
  });
}

function renderMisses() {
  el.missList.innerHTML = "";
  if (state.misses.length === 0) {
    el.missList.innerHTML = `<p class="muted">No misses saved yet.</p>`;
    return;
  }
  state.misses.forEach((miss) => {
    const item = document.createElement("div");
    item.className = "row-item";
    item.innerHTML = `
      <div>
        <strong>${miss.answer}</strong>
        <span>${miss.category} / ${miss.subcategory} / $${miss.value}</span>
        <p>${miss.clue}</p>
      </div>
      <span>${miss.grade}</span>
    `;
    el.missList.appendChild(item);
  });
}

function renderStats() {
  const total = state.results.length;
  const correct = state.results.filter((r) => r.grade === "correct").length;
  const close = state.results.filter((r) => r.grade === "close").length;
  el.statAttempts.textContent = String(total);
  el.statAccuracy.textContent = total ? `${Math.round((correct / total) * 100)}%` : "0%";
  el.statClose.textContent = total ? `${Math.round((close / total) * 100)}%` : "0%";
  el.statMisses.textContent = String(state.misses.length);

  const byCategory = {};
  state.results.forEach((result) => {
    byCategory[result.category] ||= { total: 0, correct: 0 };
    byCategory[result.category].total += 1;
    if (result.grade === "correct") byCategory[result.category].correct += 1;
  });

  el.categoryStats.innerHTML = "";
  Object.entries(byCategory).sort().forEach(([category, stats]) => {
    const item = document.createElement("div");
    item.className = "row-item";
    const accuracy = Math.round((stats.correct / stats.total) * 100);
    item.innerHTML = `<strong>${category}</strong><span>${accuracy}% (${stats.correct}/${stats.total})</span>`;
    el.categoryStats.appendChild(item);
  });

  if (Object.keys(byCategory).length === 0) {
    el.categoryStats.innerHTML = `<p class="muted">Stats appear after your first graded clue.</p>`;
  }
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${view}-view`);
  });
  el.viewLabel.textContent = view;
  el.screenTitle.textContent = {
    practice: "Question Set",
    review: "Review Misses",
    stats: "Progress",
    challenge: "Social Challenge"
  }[view];
  renderStats();
  renderMisses();
}

function buildChallenge() {
  const questions = shuffle(filteredQuestions()).slice(0, 10);
  const payload = {
    app: "trivia-trainer",
    version: 1,
    created_at: new Date().toISOString(),
    filters: {
      category: el.categoryFilter.value,
      subcategory: el.subcategoryFilter.value,
      value: el.valueFilter.value,
      mechanic: el.mechanicFilter.value
    },
    question_ids: questions.map((q) => q.id)
  };
  el.challengeCode.value = JSON.stringify(payload, null, 2);
}

async function copyChallenge() {
  if (!el.challengeCode.value) buildChallenge();
  try {
    await navigator.clipboard.writeText(el.challengeCode.value);
    el.copyChallenge.textContent = "Copied";
    setTimeout(() => { el.copyChallenge.textContent = "Copy Code"; }, 1200);
  } catch {
    el.challengeCode.select();
  }
}

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

el.categoryFilter.addEventListener("change", refreshSubcategories);
el.startSession.addEventListener("click", startSession);
el.revealAnswer.addEventListener("click", revealAnswer);
el.answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (!state.revealed) revealAnswer();
    else gradeCurrent("correct");
  }
});
document.querySelectorAll(".grade").forEach((button) => {
  button.addEventListener("click", () => gradeCurrent(button.dataset.grade));
});
el.clearMisses.addEventListener("click", () => {
  state.misses = [];
  localStorage.setItem("tt_misses", "[]");
  renderMisses();
  renderStats();
});
el.buildChallenge.addEventListener("click", buildChallenge);
el.copyChallenge.addEventListener("click", copyChallenge);

populateFilters();
startSession();
renderStats();
renderMisses();
