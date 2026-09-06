<#
.SYNOPSIS
  Registers a Windows Task Scheduler task that runs the RV_Pigeon agent
  (sync + deliver, via agent/src/index.ts) on a recurring interval.

.DESCRIPTION
  Run this yourself, once, from a PowerShell prompt in agent/ — it is not
  something this project runs on your behalf. Before running it:
    1. npm run build   (compiles src/ to dist/ — re-run this after any code changes)
    2. Make sure agent/.env and your bootstrapped session are already set up.

  Confirmed via live testing (2026-09-06), not just theorized: headless
  Chromium specifically trips Outdoorsy's Cloudflare bot-detection (a hard
  "you have been blocked" page) — a headed run moments earlier on the same
  machine/session worked cleanly. index.ts therefore always runs headed,
  with the browser window positioned off-screen rather than truly hidden,
  so it doesn't pop up in front of you. That means this task genuinely
  needs an active, logged-in desktop session to render anything at all —
  there is no "run whether logged on or not" option here, unlike a typical
  background task.

.PARAMETER IntervalMinutes
  How often to run. Matches the 30–60 minute cadence from research.md.
#>
param(
  [string]$TaskName = "RV_Pigeon Agent",
  [int]$IntervalMinutes = 30
)

$agentDir = Split-Path -Parent $PSScriptRoot
$distEntry = Join-Path $agentDir "dist\index.js"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Error "node.exe not found on PATH. Install Node.js first."
  exit 1
}
if (-not (Test-Path $distEntry)) {
  Write-Error "agent\dist\index.js not found. Run 'npm run build' in agent\ first."
  exit 1
}

$action = New-ScheduledTaskAction -Execute $nodeCmd.Source -Argument "dist\index.js" -WorkingDirectory $agentDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
  -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "Runs RV_Pigeon's Outdoorsy sync + deliver on a recurring interval." `
  -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName', running every $IntervalMinutes minutes."
Write-Host "Runs only while you're logged in (an off-screen browser window still needs an active desktop session)."
Write-Host "View/manage it: Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host "Remove it later with: Unregister-ScheduledTask -TaskName '$TaskName'"
