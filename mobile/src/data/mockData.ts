export type CategoryScore = {
  id: string;
  name: string;
  score: number;
  tier: string;
  sevenDayDelta: number;
  attempts: number;
  correctRate: number;
  avgCorrectValue: number;
  dueReview: number;
  backendMetric: 'category_competencies';
};

export type Badge = {
  name: string;
  description: string;
  earned: boolean;
};

export const categoryScores: CategoryScore[] = [
  {
    id: 'pop_culture',
    name: 'Pop Culture',
    score: 91,
    tier: 'Mastered',
    sevenDayDelta: 3,
    attempts: 82,
    correctRate: 88,
    avgCorrectValue: 720,
    dueReview: 2,
    backendMetric: 'category_competencies',
  },
  {
    id: 'mythology',
    name: 'Mythology & Philosophy',
    score: 82,
    tier: 'Strong',
    sevenDayDelta: 2,
    attempts: 48,
    correctRate: 79,
    avgCorrectValue: 620,
    dueReview: 4,
    backendMetric: 'category_competencies',
  },
  {
    id: 'literature',
    name: 'Literature & Books',
    score: 78,
    tier: 'Strong',
    sevenDayDelta: 1,
    attempts: 53,
    correctRate: 76,
    avgCorrectValue: 580,
    dueReview: 6,
    backendMetric: 'category_competencies',
  },
  {
    id: 'geography',
    name: 'Geography',
    score: 69,
    tier: 'Solid',
    sevenDayDelta: -2,
    attempts: 45,
    correctRate: 68,
    avgCorrectValue: 520,
    dueReview: 8,
    backendMetric: 'category_competencies',
  },
  {
    id: 'language',
    name: 'Language & Wordplay',
    score: 66,
    tier: 'Solid',
    sevenDayDelta: 4,
    attempts: 39,
    correctRate: 64,
    avgCorrectValue: 500,
    dueReview: 5,
    backendMetric: 'category_competencies',
  },
  {
    id: 'science',
    name: 'Science',
    score: 64,
    tier: 'Solid',
    sevenDayDelta: 0,
    attempts: 34,
    correctRate: 63,
    avgCorrectValue: 480,
    dueReview: 7,
    backendMetric: 'category_competencies',
  },
  {
    id: 'history',
    name: 'History',
    score: 58,
    tier: 'Developing',
    sevenDayDelta: 1,
    attempts: 31,
    correctRate: 58,
    avgCorrectValue: 440,
    dueReview: 9,
    backendMetric: 'category_competencies',
  },
  {
    id: 'music',
    name: 'Music & Performing Arts',
    score: 55,
    tier: 'Developing',
    sevenDayDelta: -1,
    attempts: 18,
    correctRate: 56,
    avgCorrectValue: 420,
    dueReview: 3,
    backendMetric: 'category_competencies',
  },
  {
    id: 'sports',
    name: 'Sports & Games',
    score: 42,
    tier: 'Developing',
    sevenDayDelta: 0,
    attempts: 14,
    correctRate: 45,
    avgCorrectValue: 360,
    dueReview: 6,
    backendMetric: 'category_competencies',
  },
  {
    id: 'arts',
    name: 'Arts & Visual Culture',
    score: 38,
    tier: 'Familiar',
    sevenDayDelta: -3,
    attempts: 12,
    correctRate: 39,
    avgCorrectValue: 320,
    dueReview: 7,
    backendMetric: 'category_competencies',
  },
];

export const trainingModes = [
  {
    title: 'Challenge My Weaknesses',
    subtitle: 'Arts, Sports, and $800 Geography.',
    label: 'Best next',
  },
  {
    title: 'Randomize',
    subtitle: 'Mixed categories, values, and mechanics.',
    label: 'Mix',
  },
  {
    title: 'Select Categories',
    subtitle: 'Choose one or more areas to drill.',
    label: 'Custom',
  },
  {
    title: 'Review Misses',
    subtitle: 'Spaced queue from close, missed, and no idea.',
    label: '15 due',
  },
  {
    title: 'Wordplay',
    subtitle: 'Before & After, starts-with, crossword, anagrams.',
    label: 'Skill',
  },
];

export type DailyActivity = {
  day: number;
  reps: number;
  reviewCleared: boolean;
  challengePlayed: boolean;
};

export const dailyActivity: DailyActivity[] = [
  { day: 1, reps: 0, reviewCleared: false, challengePlayed: false },
  { day: 2, reps: 8, reviewCleared: false, challengePlayed: false },
  { day: 3, reps: 31, reviewCleared: false, challengePlayed: true },
  { day: 4, reps: 35, reviewCleared: true, challengePlayed: false },
  { day: 5, reps: 0, reviewCleared: false, challengePlayed: false },
  { day: 6, reps: 12, reviewCleared: false, challengePlayed: false },
  { day: 7, reps: 42, reviewCleared: false, challengePlayed: true },
  { day: 8, reps: 30, reviewCleared: false, challengePlayed: false },
  { day: 9, reps: 16, reviewCleared: true, challengePlayed: false },
  { day: 10, reps: 0, reviewCleared: false, challengePlayed: false },
  { day: 11, reps: 38, reviewCleared: false, challengePlayed: false },
  { day: 12, reps: 40, reviewCleared: true, challengePlayed: false },
  { day: 13, reps: 9, reviewCleared: false, challengePlayed: false },
  { day: 14, reps: 0, reviewCleared: false, challengePlayed: false },
  { day: 15, reps: 12, reviewCleared: false, challengePlayed: false },
  { day: 16, reps: 34, reviewCleared: false, challengePlayed: true },
  { day: 17, reps: 39, reviewCleared: false, challengePlayed: false },
  { day: 18, reps: 14, reviewCleared: false, challengePlayed: false },
  { day: 19, reps: 0, reviewCleared: false, challengePlayed: false },
  { day: 20, reps: 33, reviewCleared: true, challengePlayed: false },
  { day: 21, reps: 36, reviewCleared: false, challengePlayed: false },
  { day: 22, reps: 10, reviewCleared: false, challengePlayed: false },
  { day: 23, reps: 31, reviewCleared: false, challengePlayed: true },
  { day: 24, reps: 41, reviewCleared: true, challengePlayed: false },
  { day: 25, reps: 9, reviewCleared: false, challengePlayed: false },
  { day: 26, reps: 0, reviewCleared: false, challengePlayed: false },
  { day: 27, reps: 12, reviewCleared: false, challengePlayed: false },
  { day: 28, reps: 33, reviewCleared: false, challengePlayed: false },
  { day: 29, reps: 34, reviewCleared: true, challengePlayed: false },
  { day: 30, reps: 24, reviewCleared: false, challengePlayed: false },
];

export const homeSummaryBullets = [
  'Weighted by difficulty and recency.',
  '376 recorded attempts.',
  'Weakest: Arts and Sports.',
];

export const dailyMetricDefinitions = [
  { label: 'Today', value: '24', detail: 'reps' },
  { label: 'Review', value: '7/15', detail: 'due' },
  { label: 'Week', value: '138', detail: 'reps' },
];

export const badges: Badge[] = [
  { name: 'Cartographer', description: 'Reach Solid in Geography.', earned: true },
  { name: 'Deep Cut', description: 'Answer 25 $800 clues correctly.', earned: true },
  { name: 'Renaissance', description: 'Improve any category by 15 points in 30 days.', earned: true },
  { name: 'Wordsmith', description: 'Reach Solid in Language & Wordplay.', earned: true },
  { name: 'Generalist', description: 'Reach Solid in all 10 primary categories.', earned: false },
  { name: 'Tournament Ready', description: 'Answer 10 $1000 clues correctly.', earned: false },
];

export const profileActions = [
  { title: 'Account', detail: 'gabe@example.com', action: 'View' },
  { title: 'Add friends', detail: 'Username or invite link', action: 'Add' },
  { title: 'Requests', detail: '2 pending', action: 'Open' },
  { title: 'Sources', detail: 'Question packs and imports', action: 'Manage' },
  { title: 'Export data', detail: 'Attempts, scores, badges', action: 'CSV' },
  { title: 'Sign out', detail: 'End this session', action: 'Sign out', destructive: true },
];
