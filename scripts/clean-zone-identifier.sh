#!/usr/bin/env bash
set -e

DIR="${1:-.}"
echo "Buscando e deletando arquivos :Zone.Identifier em $DIR..."
find "$DIR" -name "*:Zone.Identifier*" -type f -delete -print
echo "Concluido."