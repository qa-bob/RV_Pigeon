# Builds the web dashboard and publishes it to the live site (https://rvpigeon.com).
# Run from the repo root: powershell -File scripts/deploy-web.ps1

$ErrorActionPreference = "Stop"

$BucketName = "rvpigeon-web"
$DistributionId = "E1YI0ODG0EYYCP"

Write-Host "Building shared package..."
npm run build:shared
if ($LASTEXITCODE -ne 0) { throw "build:shared failed" }

Write-Host "Building web dashboard..."
npm run build -w web
if ($LASTEXITCODE -ne 0) { throw "web build failed" }

Write-Host "Syncing web/dist to s3://$BucketName ..."
aws s3 sync web/dist "s3://$BucketName" --delete
if ($LASTEXITCODE -ne 0) { throw "s3 sync failed" }

Write-Host "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*"
if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed" }

Write-Host "Done. https://rvpigeon.com (CloudFront cache invalidation can take a minute or two to finish)"
