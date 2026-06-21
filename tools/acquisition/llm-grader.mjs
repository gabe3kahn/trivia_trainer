/**
 * LLM entailment grader for source verification.
 *
 * Token-overlap corroboration (source-verifier.mjs) measures how many of a clue's
 * words reappear in the source. That's a poor proxy for factual support: a good
 * oblique clue deliberately AVOIDS the encyclopedia's wording, so the better the
 * clue, the lower its overlap. This grader is the escalation path for clues that
 * fall below the overlap bar — it asks a model whether the source text actually
 * SUPPORTS the clue's factual claims, which is the thing we actually care about.
 *
 * It shells out to the `claude` CLI (one batched call for all low-overlap clues),
 * which works wherever the drafter does: CLI authenticated via CLAUDE_CODE_OAUTH_TOKEN
 * in CI, or a local Claude Code install. If the CLI is missing or errors, it returns
 * an empty map and the caller keeps the overlap-based status — never a hard failure.
 */

import { spawn } from 'node:child_process';

const SOURCE_CHAR_CAP = 6000; // bound prompt size; the supporting fact is ~always early

/**
 * items: [{ id, clue, answer, source }]  (source = full article plaintext)
 * Returns Map(id -> { supported: boolean, sentence: string, confidence: number }).
 */
export async function gradeEntailment(items, { model = 'claude-haiku-4-5-20251001', timeoutMs = 180000 } = {}) {
  const map = new Map();
  const usable = (items ?? []).filter((it) => it && it.source && String(it.source).trim());
  if (!usable.length) return map;

  let raw;
  try {
    raw = await runClaude(buildPrompt(usable), model, timeoutMs);
  } catch {
    return map; // CLI missing / auth / timeout → skip gracefully, keep overlap status
  }

  for (const r of extractJsonArray(raw) ?? []) {
    if (!r || r.id == null) continue;
    map.set(String(r.id), {
      supported: r.supported === true,
      sentence: typeof r.sentence === 'string' ? r.sentence : '',
      confidence: Number.isFinite(r.confidence) ? Number(r.confidence) : null,
    });
  }
  return map;
}

function buildPrompt(items) {
  const blocks = items
    .map(
      (it, i) =>
        `### Item ${i + 1}\nid: ${it.id}\nANSWER: ${it.answer}\nCLUE: ${it.clue}\nSOURCE (excerpt):\n${String(it.source).slice(0, SOURCE_CHAR_CAP)}`,
    )
    .join('\n\n');
  return [
    'You are a fact-checker for a trivia app. For each item below, decide whether the SOURCE text',
    "supports the factual claims the CLUE makes about its ANSWER. The clue is intentionally worded",
    'differently from the source — judge the FACTS, not word overlap. Mark supported=true only if the',
    'source substantiates the clue\'s claims (a claim merely being true general knowledge is NOT enough —',
    'it must be backed by THIS source text). If the source is the wrong topic or contradicts the clue,',
    'mark supported=false.',
    '',
    'Respond with ONLY a JSON array, no prose, no code fences. One object per item:',
    '[{"id": "<the id>", "supported": true|false, "sentence": "<the source sentence that backs it, or \\"\\">", "confidence": 0.0-1.0}]',
    '',
    blocks,
  ].join('\n');
}

function runClaude(prompt, model, timeoutMs) {
  return new Promise((resolve, reject) => {
    // shell:true so the npm-global `claude` shim resolves on Windows + POSIX.
    // The prompt is piped via stdin (not argv) so size/quoting are non-issues;
    // argv contains only fixed flags, so there's no shell-injection surface.
    const child = spawn(`claude -p --output-format json --model ${model}`, { shell: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('claude grader timed out'));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`));
      // --output-format json wraps the reply: { type:'result', result:'<text>', ... }
      try {
        const env = JSON.parse(out);
        resolve(typeof env.result === 'string' ? env.result : out);
      } catch {
        resolve(out);
      }
    });
    child.stdin.end(prompt);
  });
}

function extractJsonArray(text) {
  if (!text) return null;
  const fenced = text.replace(/```(?:json)?/gi, '');
  const start = fenced.indexOf('[');
  const end = fenced.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}
