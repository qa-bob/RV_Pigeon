# Deploys the latest main branch to the live API (https://api.rvpigeon.com):
# pulls, rebuilds, and restarts the systemd service over SSH.
# Run from the repo root: powershell -File scripts/deploy-api.ps1

$ErrorActionPreference = "Stop"

$KeyPath = "$HOME\.ssh\rv-pigeon-api.pem"
$Target = "ec2-user@77.112.87.160"
$RemoteDir = "/home/ec2-user/RV_Pigeon"

$RemoteCommand = @"
set -e
cd $RemoteDir
git pull
npm install
npm run build:shared
npm run build -w api
sudo systemctl restart rv-pigeon-api
sleep 2
sudo systemctl status rv-pigeon-api --no-pager | head -6
"@

Write-Host "Deploying API to $Target ..."
ssh -i $KeyPath $Target $RemoteCommand
if ($LASTEXITCODE -ne 0) { throw "Remote deploy command failed" }

Write-Host "Checking health endpoint..."
Start-Sleep -Seconds 2
Invoke-RestMethod -Uri "https://api.rvpigeon.com/health"
