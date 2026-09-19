#!/usr/bin/env bash
set -euo pipefail

projectRoot="$(cd "$(dirname "$0")/../.." && pwd)"
rcloneBin="$projectRoot/.tools/rclone/rclone"
mountPoint="$projectRoot/R2"
runtimeDir="$projectRoot/.tools/r2-mount"
cacheDir="$projectRoot/.tools/rclone-cache"
stateFile="$runtimeDir/rclone-state.json"
legacyPidFile="$runtimeDir/rclone.pid"
logFile="$runtimeDir/rclone.log"

get_verified_mount_process() {
    local pid="$1"
    local saved_exe="$2"
    local saved_mount="$3"

    # Check process is alive
    if ! kill -0 "$pid" 2>/dev/null; then
        return 1
    fi

    # Verify it's rclone
    local exe
    exe="$(readlink -f "/proc/$pid/exe" 2>/dev/null)" || return 1
    local saved_exe_real
    saved_exe_real="$(readlink -f "$saved_exe")" || return 1
    if [[ "$exe" != "$saved_exe_real" ]]; then
        return 1
    fi

    # Verify mount point in command line
    local cmdline
    cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)" || return 1
    local saved_mount_real
    saved_mount_real="$(readlink -f "$saved_mount")" || return 1
    if [[ "$cmdline" != *"$saved_mount_real"* ]]; then
        return 1
    fi

    return 0
}

# --- Check rclone binary exists ---
if [[ ! -f "$rcloneBin" ]]; then
    echo "rclone nao encontrado em $rcloneBin" >&2
    exit 1
fi

# --- Check existing state ---
if [[ -f "$stateFile" ]]; then
    state_pid="$(jq -r '.pid // empty' "$stateFile" 2>/dev/null)" || state_pid=""
    state_exe="$(jq -r '.executablePath // empty' "$stateFile" 2>/dev/null)" || state_exe=""
    state_mount="$(jq -r '.mountPoint // empty' "$stateFile" 2>/dev/null)" || state_mount=""

    if [[ -n "$state_pid" && -n "$state_exe" && -n "$state_mount" ]] \
        && get_verified_mount_process "$state_pid" "$state_exe" "$state_mount"; then
        echo "R2 inteiro ja esta montado (PID $state_pid)."
        exit 0
    fi
    rm -f "$stateFile"
fi

# --- Check legacy PID file ---
if [[ -f "$legacyPidFile" ]]; then
    legacyPid="$(cat "$legacyPidFile")"
    if kill -0 "$legacyPid" 2>/dev/null; then
        echo "Estado legado aponta para um processo ativo e nao sera encerrado sem verificacao manual (PID $legacyPid)." >&2
        exit 1
    fi
    rm -f "$legacyPidFile"
fi

# --- Prepare directories ---
mkdir -p "$runtimeDir"
mkdir -p "$cacheDir"

# --- Ensure mount point is empty ---
if [[ -d "$mountPoint" ]]; then
    if [[ -n "$(ls -A "$mountPoint" 2>/dev/null)" ]]; then
        echo "$mountPoint precisa estar vazia antes da montagem." >&2
        exit 1
    fi
    rmdir "$mountPoint"
fi

# --- Clean old log ---
rm -f "$logFile"

# --- Start rclone mount ---
"$rcloneBin" mount \
    kurrutina-r2:kurrutina-bot-pictures \
    "$mountPoint" \
    --vfs-cache-mode full \
    --vfs-cache-max-size 2G \
    --dir-cache-time 10s \
    --poll-interval 0 \
    --cache-dir "$cacheDir" \
    --volname "Kurrutina Bot R2" \
    --log-file "$logFile" \
    --log-level INFO \
    &

rclone_pid=$!
sleep 2

# --- Verify it started ---
if ! kill -0 "$rclone_pid" 2>/dev/null; then
    echo "A montagem falhou. Consulte $logFile" >&2
    exit 1
fi

# --- Persist state ---
jq -n \
    --argjson pid "$rclone_pid" \
    --arg startedAtUtc "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg executablePath "$(readlink -f "$rcloneBin")" \
    --arg mountPoint "$(readlink -f "$mountPoint")" \
    '{ pid: $pid, startedAtUtc: $startedAtUtc, executablePath: $executablePath, mountPoint: $mountPoint }' \
    > "$stateFile"

echo "Bucket R2 inteiro montado em $mountPoint (PID $rclone_pid)."
