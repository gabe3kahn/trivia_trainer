/**
 * Compact formatter for `claude -p --output-format stream-json --verbose` output.
 *
 * Reads the NDJSON event stream on stdin and prints ONE readable, relative-
 * timestamped line per event, so the GitHub Actions log shows which step (tool
 * call vs LLM turn) is eating wall-clock AS IT HAPPENS — instead of plain
 * `--verbose`, which `claude -p` buffers into a single dump at the very end.
 *
 * Non-JSON lines pass through untouched. This only reads stdin and writes stdout,
 * so it never changes the pipeline's exit status (guard the pipe with pipefail).
 */

let start = null;
let buf = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    emit(buf.slice(0, nl));
    buf = buf.slice(nl + 1);
  }
});
process.stdin.on('end', () => {
  if (buf.trim()) emit(buf);
});

function clip(value, max = 140) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function stamp() {
  if (start == null) start = Date.now();
  return `+${((Date.now() - start) / 1000).toFixed(1)}s`.padStart(8);
}

function emit(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  let event;
  try {
    event = JSON.parse(trimmed);
  } catch {
    console.log(trimmed); // not an event line — pass through
    return;
  }
  const t = stamp();
  if (event.type === 'system' && event.subtype === 'init') {
    console.log(`${t}  init   model=${event.model ?? '?'} tools=${(event.tools ?? []).length}`);
  } else if (event.type === 'assistant') {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'text' && block.text.trim()) console.log(`${t}  say    ${clip(block.text)}`);
      else if (block.type === 'tool_use') console.log(`${t}  TOOL   ${block.name}: ${clip(JSON.stringify(block.input))}`);
    }
  } else if (event.type === 'user') {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_result') {
        const content = Array.isArray(block.content) ? block.content.map((x) => x.text ?? '').join(' ') : block.content;
        console.log(`${t}    ->   ${clip(content)}`);
      }
    }
  } else if (event.type === 'result') {
    console.log(`${t}  DONE   ${event.subtype ?? ''} turns=${event.num_turns ?? '?'} dur=${event.duration_ms ?? '?'}ms`);
    if (event.result) console.log(clip(event.result, 4000));
  }
}
