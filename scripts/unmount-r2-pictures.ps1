$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot ".tools\r2-mount\rclone.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Output "Pictures nao esta montada."
    exit 0
}

$mountPid = [int](Get-Content -Raw -LiteralPath $pidFile)
$process = Get-Process -Id $mountPid -ErrorAction SilentlyContinue

if ($process) {
    Stop-Process -Id $mountPid
    $process.WaitForExit(5000) | Out-Null
}

Remove-Item -LiteralPath $pidFile -Force
Write-Output "Cloudflare R2 desmontado de Pictures."
