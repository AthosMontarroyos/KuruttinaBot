$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$rcloneExe = Join-Path $projectRoot ".tools\rclone\rclone.exe"
$mountPoint = Join-Path $projectRoot "R2"
$runtimeDir = Join-Path $projectRoot ".tools\r2-mount"
$cacheDir = Join-Path $projectRoot ".tools\rclone-cache"
$stateFile = Join-Path $runtimeDir "rclone-state.json"
$legacyPidFile = Join-Path $runtimeDir "rclone.pid"
$logFile = Join-Path $runtimeDir "rclone.log"

function Get-VerifiedMountProcess {
    param([object]$State)

    if (-not $State -or -not $State.pid -or -not $State.startedAtUtc -or -not $State.executablePath -or -not $State.mountPoint) {
        return $null
    }

    $candidate = Get-Process -Id ([int]$State.pid) -ErrorAction SilentlyContinue
    if (-not $candidate) { return $null }

    $sameExecutable = [string]::Equals(
        [IO.Path]::GetFullPath([string]$State.executablePath),
        [IO.Path]::GetFullPath([string]$candidate.Path),
        [StringComparison]::OrdinalIgnoreCase
    )
    $sameMountPoint = [string]::Equals(
        [IO.Path]::GetFullPath([string]$State.mountPoint),
        [IO.Path]::GetFullPath($mountPoint),
        [StringComparison]::OrdinalIgnoreCase
    )
    $sameStartTime = $candidate.StartTime.ToUniversalTime().ToString("o") -eq [string]$State.startedAtUtc

    if ($sameExecutable -and $sameMountPoint -and $sameStartTime) { return $candidate }
    return $null
}

if (-not (Test-Path -LiteralPath $rcloneExe -PathType Leaf)) {
    throw "rclone nao encontrado em $rcloneExe"
}

if (Test-Path -LiteralPath $stateFile) {
    try { $state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json }
    catch { $state = $null }
    $existingProcess = Get-VerifiedMountProcess -State $state
    if ($existingProcess) {
        Write-Output "R2 inteiro ja esta montado (PID $($existingProcess.Id))."
        exit 0
    }
    Remove-Item -LiteralPath $stateFile -Force
}

if (Test-Path -LiteralPath $legacyPidFile) {
    $legacyPid = [int](Get-Content -Raw -LiteralPath $legacyPidFile)
    if (Get-Process -Id $legacyPid -ErrorAction SilentlyContinue) {
        throw "Estado legado aponta para um processo ativo e nao sera encerrado sem verificacao manual (PID $legacyPid)."
    }
    Remove-Item -LiteralPath $legacyPidFile -Force
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

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
    "--cache-dir", ('"' + $cacheDir + '"'),
    "--volname", '"Kurrutina Bot R2"',
    "--log-file", ('"' + $logFile + '"'),
    "--log-level", "INFO"
)

$process = Start-Process -FilePath $rcloneExe -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2

if ($process.HasExited) {
    throw "A montagem falhou. Consulte $logFile"
}

@{
    pid = $process.Id
    startedAtUtc = $process.StartTime.ToUniversalTime().ToString("o")
    executablePath = [IO.Path]::GetFullPath($rcloneExe)
    mountPoint = [IO.Path]::GetFullPath($mountPoint)
} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding utf8

Write-Output "Bucket R2 inteiro montado em $mountPoint (PID $($process.Id))."
