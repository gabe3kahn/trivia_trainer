/**
 * llm-batch — the shared "tag a corpus with a small LLM, in batches" component.
 *
 * Factored out of keyword-topics.mjs (which tags pool topics with subject keywords) so the
 * same proven foundation backs every batched-Claude tagging job — currently pool keywording
 * AND clue topic-entity tagging (topic-entities.mjs). One place for: the `claude -p` call on
 * the subscription OAuth token (no API key), the Windows shim resolution, fenced-JSON parsing,
 * the batching loop, and per-batch persistence (resumable + budget-limited).
 *
 * Callers supply a prompt builder and a parser; the component runs the batches and returns a
 * key→value Map. Keep the model small (Haiku) and the batch modest (~40) — this is bulk
 * classification, not reasoning.
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function resolveClaudeBin() {
  return process.env.CLAUDE_BIN
    || (process.platform === 'win32' && process.env.APPDATA ? path.join(process.env.APPDATA, 'npm', 'claude.cmd') : 'claude');
}

/** One `claude -p` call; returns raw stdout. Throws on non-zero exit / empty output. */
export function runClaude(prompt, { model = 'claude-haiku-4-5', timeoutMs = 180000 } = {}) {
  const res = spawnSync(resolveClaudeBin(), ['-p', '--model', model], {
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: timeoutMs,
    shell: process.platform === 'win32',
  });
  if (res.status !== 0 || !res.stdout) {
    throw new Error(`claude call failed (status ${res.status}): ${(res.stderr || '').slice(0, 200)}`);
  }
  return res.stdout;
}

/** Extract the first {...} JSON object from a (possibly fenced) LLM reply. {} on failure. */
export function parseJsonObject(text) {
  const s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) return {};
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return {}; }
}

/**
 * Tag `items` in batches. `buildPrompt(batch)` → prompt string; `parse(stdout)` → object
 * mapping each item's key to its value. Returns a Map of all keys→values. `onBatch({index,
 * batch, parsed, total})` runs after each batch (e.g. to persist progress) — resumability is
 * the caller's job (skip already-tagged items before calling). A failed batch is logged and
 * skipped, not fatal.
 */
export async function batchClassify({ items, buildPrompt, parse = parseJsonObject, batchSize = 40, model = 'claude-haiku-4-5', onBatch }) {
  const out = new Map();
  const batches = Math.ceil(items.length / batchSize);
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const index = i / batchSize + 1;
    let parsed = {};
    try { parsed = parse(runClaude(buildPrompt(batch), { model })); }
    catch (e) { console.error(`  ! batch ${index}/${batches} failed: ${String(e.message).slice(0, 160)}`); }
    for (const [k, v] of Object.entries(parsed)) out.set(k, v);
    if (onBatch) await onBatch({ index, batches, batch, parsed, total: out.size });
  }
  return out;
}
