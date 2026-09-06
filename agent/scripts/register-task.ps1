<#
.SYNOPSIS
  Registers a Windows Task Scheduler task that runs the RV_Pigeon agent
  (sync + deliver, via agent/src/index.ts) on a recurring interval.

.DESCRIPTION
  Run this yourself, once, from a PowerShell prompt in agent/ — it is not
  something this project runs on your behalf. Before running it:
    1. npm run build   (compiles src/ to dist/ — re-run this after any code changes)
    2. Make sure agent/.env and your bootstrapped session are already set up.

  If Outdoorsy's bot-detection turns out to specifically flag headless
  Chromium (unconfirmed as of this writing — see research.md "Automation
  execution location"), the workaround is: set RV_PIGEON_HEADLESS=false in
  agent/.env, and re-run this script with -RequireLogon so the task only
  fires while you're logged in (a real, briefly-visible browser window
  needs an active desktop session to render at all).

.PARAMETER IntervalMinutes
  How often to run. Matches the 30–60 minute cadence from research.md.

.PARAMETER RequireLogon
  If set, the task only runs while you're logged in (required if you
  switch to a non-headless agent). Default: runs whether logged on or not.
#>
param(
  [string]$TaskName = "RV_Pigeon Agent",
  [int]$IntervalMinutes = 30,
  [switch]$RequireLogon
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

if ($RequireLogon) {
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
} else {
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "Runs RV_Pigeon's Outdoorsy sync + deliver on a recurring interval." `
  -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName', running every $IntervalMinutes minutes."
Write-Host "View/manage it: Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host "Remove it later with: Unregister-ScheduledTask -TaskName '$TaskName'"
