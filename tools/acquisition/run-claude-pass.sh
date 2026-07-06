#!/usr/bin/env bash
# Run ONE headless Claude Code pass over a prompt file, streaming the run as NDJSON
# through format-stream.mjs so the wall-clock timeline is readable live.
#
# RETRY on transient server-side errors ONLY (529 / 5xx / overloaded), with escalating
# backoff (5/10/20 min): a single Anthropic 529 mid-run otherwise throws away a ~25-50 min
# pass. A GENUINE failure fails fast (a real bug should not be retried). `set +e` because
# the default GitHub shell is `bash -eo pipefail`, which would abort on the first failed
# pipeline before the loop can react; PIPESTATUS[1] is claude's own exit (cat=0, claude=1,
# tee=2, node=3) — the real success signal.
#
# Usage: run-claude-pass.sh <prompt-file> [model] [max_attempts]
set +e

prompt_file="$1"
model="${2:-claude-sonnet-4-6}"
max_attempts="${3:-4}"
if [ -z "$prompt_file" ] || [ ! -f "$prompt_file" ]; then
  echo "::error::run-claude-pass.sh: prompt file '$prompt_file' not found." >&2
  exit 1
fi

label="$(basename "$prompt_file")"
log="$(mktemp)"
attempt=1
while :; do
  echo "::group::${label} attempt ${attempt}/${max_attempts}"
  cat "$prompt_file" | claude -p --verbose --output-format stream-json \
    --model "$model" \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep,TodoWrite" \
    --max-turns 120 | tee "$log" | node tools/acquisition/format-stream.mjs
  status=${PIPESTATUS[1]}
  echo "::endgroup::"

  if [ "$status" -eq 0 ]; then
    echo "${label} succeeded on attempt ${attempt}."
    exit 0
  fi

  if [ "$attempt" -lt "$max_attempts" ] && \
     grep -qiE '529|overloaded|api error: 5[0-9][0-9]|internal server error|service unavailable|temporarily unavailable' "$log"; then
    backoff=$(( 300 * (1 << (attempt - 1)) ))
    echo "::warning::${label} attempt ${attempt} hit a transient API error (claude exit ${status}). Retrying in ${backoff}s…"
    sleep "${backoff}"
    attempt=$(( attempt + 1 ))
    continue
  fi

  echo "::error::${label} failed on attempt ${attempt} (claude exit ${status}) — not a retryable transient error, or retries exhausted."
  exit 1
done
