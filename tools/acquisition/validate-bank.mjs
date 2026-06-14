import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const taxonomyPath = path.join(rootDir, 'data', 'category-taxonomy.json');
const bankPath = process.argv[2];

if (!bankPath) {
  throw new Error('Usage: node tools/acquisition/validate-bank.mjs <normalized-question-bank.json>');
}

const taxonomy = JSON.parse(await fs.readFile(taxonomyPath, 'utf8'));
const bank = JSON.parse(await fs.readFile(path.resolve(bankPath), 'utf8'));
const questions = Array.isArray(bank) ? bank : bank.questions;
if (!Array.isArray(questions)) {
  throw new Error('Question bank must be an array or an object with a questions array.');
}

const categories = new Map(taxonomy.primary_categories.map((category) => [category.id, category]));
const allowedMechanics = new Set(taxonomy.clue_mechanics);
const allowedValues = new Set(taxonomy.difficulty_values.map((value) => value.value));
const seenExternalIds = new Set();
const seenClueAnswers = new Set();
const errors = [];
const warnings = [];

questions.forEach((question, index) => {
  const label = question.external_id ?? `index ${index}`;
  const category = categories.get(question.category_id);

  requireField(question, 'source', label);
  requireField(question, 'external_id', label);
  requireField(question, 'category_id', label);
  requireField(question, 'subcategory_name', label);
  requireField(question, 'value', label);
  requireField(question, 'difficulty_rank', label);
  requireField(question, 'mechanic', label);
  requireField(question, 'clue', label);
  requireField(question, 'answer', label);

  if (question.external_id) {
    if (seenExternalIds.has(question.external_id)) errors.push(`${label}: duplicate external_id.`);
    seenExternalIds.add(question.external_id);
  }

  if (!category) {
    errors.push(`${label}: unknown category_id "${question.category_id}".`);
  } else if (!category.subcategories.includes(question.subcategory_name)) {
    errors.push(`${label}: "${question.subcategory_name}" is not a subcategory of ${question.category_id}.`);
  }

  if (!allowedValues.has(question.value)) {
    errors.push(`${label}: value must be one of ${[...allowedValues].join(', ')}.`);
  }

  if (!allowedMechanics.has(question.mechanic)) {
    errors.push(`${label}: unknown mechanic "${question.mechanic}".`);
  }

  if ((question.clue ?? '').length < 12) {
    warnings.push(`${label}: clue is very short.`);
  }

  if ((question.answer ?? '').length < 2) {
    warnings.push(`${label}: answer is very short.`);
  }

  if (question.mechanic === 'starts_with' && question.constraint_text) {
    const constraint = question.constraint_text.replace(/^starts with\s+/i, '').replace(/"/g, '').trim().toLowerCase();
    if (!question.answer.toLowerCase().startsWith(constraint)) {
      errors.push(`${label}: starts_with constraint does not match answer.`);
    }
  }

  if (question.mechanic === 'ends_with' && question.constraint_text) {
    const constraint = question.constraint_text.replace(/^ends with\s+/i, '').replace(/"/g, '').trim().toLowerCase();
    if (!question.answer.toLowerCase().endsWith(constraint)) {
      errors.push(`${label}: ends_with constraint does not match answer.`);
    }
  }

  const clueAnswerKey = `${question.clue}`.toLowerCase().replace(/\s+/g, ' ').trim()
    + '|'
    + `${question.answer}`.toLowerCase().replace(/\s+/g, ' ').trim();
  if (seenClueAnswers.has(clueAnswerKey)) warnings.push(`${label}: duplicate clue/answer pair.`);
  seenClueAnswers.add(clueAnswerKey);
});

console.log(`Validated ${questions.length} questions.`);
console.log(`${errors.length} errors, ${warnings.length} warnings.`);

if (warnings.length) {
  console.log('\nWarnings:');
  warnings.slice(0, 50).forEach((warning) => console.log(`- ${warning}`));
  if (warnings.length > 50) console.log(`- ...and ${warnings.length - 50} more warnings.`);
}

if (errors.length) {
  console.log('\nErrors:');
  errors.forEach((error) => console.log(`- ${error}`));
  process.exitCode = 1;
}

function requireField(question, field, label) {
  if (question[field] === undefined || question[field] === null || question[field] === '') {
    errors.push(`${label}: missing ${field}.`);
  }
}
