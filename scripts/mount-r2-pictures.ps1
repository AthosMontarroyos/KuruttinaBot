$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$rcloneExe = Join-Path $projectRoot ".tools\rclone\rclone.exe"
$mountPoint = Join-Path $projectRoot "Pictures"
$runtimeDir = Join-Path $projectRoot ".tools\r2-mount"
$pidFile = Join-Path $runtimeDir "rclone.pid"
$logFile = Join-Path $runtimeDir "rclone.log"

if (-not (Test-Path -LiteralPath $rcloneExe -PathType Leaf)) {
    throw "rclone nao encontrado em $rcloneExe"
}

if (Test-Path -LiteralPath $pidFile) {
    $existingPid = [int](Get-Content -Raw -LiteralPath $pidFile)
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        Write-Output "Pictures ja esta montada (PID $existingPid)."
        exit 0
    }
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

if (Test-Path -LiteralPath $mountPoint) {
    if (Get-ChildItem -LiteralPath $mountPoint -Force | Select-Object -First 1) {
        throw "$mountPoint precisa estar vazia antes da montagem."
    }

    Remove-Item -LiteralPath $mountPoint -Force
}

Remove-Item -LiteralPath $logFile -Force -ErrorAction SilentlyContinue

$arguments = @(
    "mount",
    "kurrutina-r2:kurrutina-bot-pictures",
    ('"' + $mountPoint + '"'),
    "--vfs-cache-mode", "full",
    "--vfs-cache-max-size", "2G",
    "--dir-cache-time", "10s",
    "--poll-interval", "0",
    "--volname", '"Kurrutina Bot Pictures"',
    "--log-file", ('"' + $logFile + '"'),
    "--log-level", "INFO"
)

$process = Start-Process -FilePath $rcloneExe -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
$process.Id | Set-Content -LiteralPath $pidFile -Encoding ascii
Start-Sleep -Seconds 2

if ($process.HasExited) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    throw "A montagem falhou. Consulte $logFile"
}

Write-Output "Cloudflare R2 montado em $mountPoint (PID $($process.Id))."
