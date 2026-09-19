#!/usr/bin/env bash
set -euo pipefail

projectRoot="$(cd "$(dirname "$0")/../.." && pwd)"
rcloneBin="$projectRoot/.tools/rclone/rclone"
mountPoint="$projectRoot/R2"
runtimeDir="$projectRoot/.tools/r2-mount"
stateFile="$runtimeDir/rclone-state.json"
legacyPidFile="$runtimeDir/rclone.pid"

# --- No state file ---
if [[ ! -f "$stateFile" ]]; then
    if [[ -f "$legacyPidFile" ]]; then
        legacyPid="$(cat "$legacyPidFile")"
        if kill -0 "$legacyPid" 2>/dev/null; then
            echo "Estado legado aponta para um processo ativo e nao sera encerrado sem verificacao manual (PID $legacyPid)." >&2
            exit 1
        fi
        rm -f "$legacyPidFile"
    fi
    echo "R2 nao esta montado."
    exit 0
fi

# --- Parse state ---
state_pid="$(jq -r '.pid // empty' "$stateFile" 2>/dev/null)" || state_pid=""
state_exe="$(jq -r '.executablePath // empty' "$stateFile" 2>/dev/null)" || state_exe=""
state_mount="$(jq -r '.mountPoint // empty' "$stateFile" 2>/dev/null)" || state_mount=""

if [[ -z "$state_pid" ]]; then
    rm -f "$stateFile"
    echo "Estado da montagem era invalido e foi descartado; nenhum processo foi encerrado." >&2
    exit 1
fi

# --- Check process alive ---
if ! kill -0 "$state_pid" 2>/dev/null; then
    rm -f "$stateFile"
    echo "R2 nao esta montado; estado obsoleto removido."
    exit 0
fi

# --- Verify it's the right rclone process ---
exe="$(readlink -f "/proc/$state_pid/exe" 2>/dev/null)" || exe=""
state_exe_real="$(readlink -f "$state_exe")" || state_exe_real=""
rclone_real="$(readlink -f "$rcloneBin")" || rclone_real=""

cmdline="$(tr '\0' ' ' < "/proc/$state_pid/cmdline" 2>/dev/null)" || cmdline=""
state_mount_real="$(readlink -f "$state_mount")" || state_mount_real=""

if [[ "$exe" != "$state_exe_real" ]] \
    || [[ "$exe" != "$rclone_real" ]] \
    || [[ "$cmdline" != *"$state_mount_real"* ]]; then
    echo "O PID registrado nao pertence a montagem esperada; nenhum processo foi encerrado." >&2
    exit 1
fi

# --- Kill rclone ---
kill "$state_pid"

# Wait up to 5 seconds
for i in $(seq 1 50); do
    if ! kill -0 "$state_pid" 2>/dev/null; then
        break
    fi
    sleep 0.1
done

if kill -0 "$state_pid" 2>/dev/null; then
    echo "rclone nao encerrou dentro de 5 segundos; estado preservado para nova verificacao." >&2
    exit 1
fi

rm -f "$stateFile"
echo "Bucket R2 inteiro desmontado."
