$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$rcloneExe = Join-Path $projectRoot ".tools\rclone\rclone.exe"
$mountPoint = Join-Path $projectRoot "R2"
$runtimeDir = Join-Path $projectRoot ".tools\r2-mount"
$stateFile = Join-Path $runtimeDir "rclone-state.json"
$legacyPidFile = Join-Path $runtimeDir "rclone.pid"

if (-not (Test-Path -LiteralPath $stateFile)) {
    if (Test-Path -LiteralPath $legacyPidFile) {
        $legacyPid = [int](Get-Content -Raw -LiteralPath $legacyPidFile)
        if (Get-Process -Id $legacyPid -ErrorAction SilentlyContinue) {
            throw "Estado legado aponta para um processo ativo e nao sera encerrado sem verificacao manual (PID $legacyPid)."
        }
        Remove-Item -LiteralPath $legacyPidFile -Force
    }
    Write-Output "R2 nao esta montado."
    exit 0
}

try { $state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json }
catch {
    Remove-Item -LiteralPath $stateFile -Force
    throw "Estado da montagem era invalido e foi descartado; nenhum processo foi encerrado."
}

$process = Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
if (-not $process) {
    Remove-Item -LiteralPath $stateFile -Force
    Write-Output "R2 nao esta montado; estado obsoleto removido."
    exit 0
}

$sameExecutable = [string]::Equals(
    [IO.Path]::GetFullPath([string]$state.executablePath),
    [IO.Path]::GetFullPath([string]$process.Path),
    [StringComparison]::OrdinalIgnoreCase
)
$sameMountPoint = [string]::Equals(
    [IO.Path]::GetFullPath([string]$state.mountPoint),
    [IO.Path]::GetFullPath($mountPoint),
    [StringComparison]::OrdinalIgnoreCase
)
$sameExpectedExecutable = [string]::Equals(
    [IO.Path]::GetFullPath([string]$state.executablePath),
    [IO.Path]::GetFullPath($rcloneExe),
    [StringComparison]::OrdinalIgnoreCase
)
$sameStartTime = $process.StartTime.ToUniversalTime().ToString("o") -eq [string]$state.startedAtUtc

if (-not ($sameExecutable -and $sameMountPoint -and $sameExpectedExecutable -and $sameStartTime)) {
    throw "O PID registrado nao pertence a montagem esperada; nenhum processo foi encerrado."
}

Stop-Process -Id ([int]$state.pid) -Force
$process.WaitForExit(5000) | Out-Null
if (Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue) {
    throw "rclone nao encerrou dentro de 5 segundos; estado preservado para nova verificacao."
}

Remove-Item -LiteralPath $stateFile -Force
Write-Output "Bucket R2 inteiro desmontado."
