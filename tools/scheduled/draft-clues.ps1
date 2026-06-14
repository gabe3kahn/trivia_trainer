# Scheduled local drafting of candidate trivia clues (TriviaTrainer-DraftClues task).
# Runs Claude Code headless against the repo: picks an under-covered category, authors
# ~15 source-grounded clues, verifies them, dry-run-gates them, and opens a PR for review.
# It never imports live and never merges (enforced by the prompt's hard rules).

$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\gabe2\claude\personal_projects\trivia_trainer'
Set-Location $repo

$log    = Join-Path $repo 'data\sourcing\_draft-clues.log'
$claude = Join-Path $env:APPDATA 'npm\claude.cmd'
$prompt = Get-Content -Raw (Join-Path $repo 'planning\draft-clues-prompt.md')

"`n===== draft-clues run $(Get-Date -Format o) =====" | Out-File -Append -Encoding utf8 $log

# Headless, unattended: pin Sonnet for cost/speed. Use an explicit tool allowlist
# (NOT --dangerously-skip-permissions) so only these tools auto-approve and every other
# Claude Code guardrail stays intact. All output (stdout+stderr) is appended to the log.
$allowed = 'Bash,Read,Write,Edit,Glob,Grep,TodoWrite'
$prompt | & $claude -p --model claude-sonnet-4-6 --allowedTools $allowed --max-turns 120 *>> $log

"===== exit $LASTEXITCODE at $(Get-Date -Format o) =====" | Out-File -Append -Encoding utf8 $log
