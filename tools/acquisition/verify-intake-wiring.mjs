import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const expectations = [
  {
    file: 'tools/acquisition/intake-assessment.mjs',
    required: [
      './question-quality-rules.mjs',
      './feedback-quality-rules.mjs',
      './difficulty-rules.mjs',
    ],
  },
  {
    file: 'tools/acquisition/import-to-supabase.mjs',
    required: ['./intake-assessment.mjs', './acquisition-utils.mjs'],
  },
  {
    file: 'tools/acquisition/build-import-sql.mjs',
    required: ['./intake-assessment.mjs', './acquisition-utils.mjs'],
  },
  {
    file: 'tools/acquisition/fill-opentdb-targets.mjs',
    required: ['./intake-assessment.mjs', './acquisition-utils.mjs'],
  },
  {
    file: 'tools/acquisition/audit-feedback-issues.mjs',
    required: ['./feedback-quality-rules.mjs', './acquisition-utils.mjs'],
  },
  {
    file: 'tools/acquisition/evaluate-difficulty.mjs',
    required: ['./difficulty-rules.mjs', './acquisition-utils.mjs'],
  },
];

const failures = [];

for (const expectation of expectations) {
  const contents = await fs.readFile(path.join(root, expectation.file), 'utf8');
  for (const required of expectation.required) {
    if (!contents.includes(required)) {
      failures.push(`${expectation.file} does not import ${required}`);
    }
  }
}

const intake = await fs.readFile(path.join(root, 'tools/acquisition/intake-assessment.mjs'), 'utf8');
for (const symbol of ['auditQuestion', 'auditFeedbackIssues', 'evaluateDifficulty', 'chooseCalibratedValue']) {
  if (!intake.includes(symbol)) {
    failures.push(`tools/acquisition/intake-assessment.mjs does not call ${symbol}`);
  }
}

if (failures.length) {
  console.error('Intake wiring check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Intake wiring OK: quality, feedback, and difficulty assessments flow through shared intake.');
