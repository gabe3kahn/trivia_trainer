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

# Keep the machine awake for the duration so an idle/inactivity-timeout sleep doesn't
# kill the run mid-flight. This does NOT override a manual lid close — but the retry
# loop below recovers from that: if the laptop sleeps mid-run, the suspended process
# resumes when the lid reopens and the next attempt runs against a fresh connection.
$sig = @'
[DllImport("kernel32.dll", SetLastError = true)]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
$power = Add-Type -MemberDefinition $sig -Name Power -Namespace Win32 -PassThru
$ES_CONTINUOUS      = [uint32]'0x80000000'
$ES_SYSTEM_REQUIRED = [uint32]'0x00000001'
[void]$power::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)

# Headless, unattended: pin Sonnet for cost/speed. Use an explicit tool allowlist
# (NOT --dangerously-skip-permissions) so only these tools auto-approve and every other
# Claude Code guardrail stays intact. All output (stdout+stderr) is appended to the log.
$allowed     = 'Bash,Read,Write,Edit,Glob,Grep,TodoWrite'
$maxAttempts = 3
$code        = 1

try {
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    "`n===== draft-clues run $(Get-Date -Format o) (attempt $attempt/$maxAttempts) =====" | Out-File -Append -Encoding utf8 $log

    # Start every attempt from a clean main so a partial prior attempt's local
    # edits/branch don't ride along (the prompt also re-checks out main itself).
    git checkout main *>> $log

    $prompt | & $claude -p --model claude-sonnet-4-6 --allowedTools $allowed --max-turns 120 *>> $log
    $code = $LASTEXITCODE

    "===== exit $code at $(Get-Date -Format o) =====" | Out-File -Append -Encoding utf8 $log
    if ($code -eq 0) { break }

    # Most failures here are transient: the network wasn't ready yet, or the laptop
    # slept mid-run and the API socket died on wake. Wait, then retry — by the next
    # attempt the machine is awake and connectivity is back. Backoff 60s, then 120s.
    if ($attempt -lt $maxAttempts) {
      "----- attempt $attempt failed (exit $code); retrying after backoff -----" | Out-File -Append -Encoding utf8 $log
      Start-Sleep -Seconds (60 * $attempt)
    }
  }
}
finally {
  # Release the keep-awake lock so normal power management resumes.
  [void]$power::SetThreadExecutionState($ES_CONTINUOUS)
}

# Propagate the final exit code so the scheduled task's own restart-on-failure
# (RestartCount / RestartInterval) still engages if all in-wrapper attempts fail.
exit $code
