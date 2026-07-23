#!/usr/bin/env bash
# Lock de exclusão mútua entre processos via mkdir atômico. Serializa toda
# escrita em docs/execucao/ e a janela crítica de merge entre execuções
# concorrentes dos workflows autônomos (ciclo-subfase / ciclo-multionda).
#
# Extraído do prompt inline (v2) para um script versionado e testável: o agente
# apenas INVOCA "bash lock.sh <cmd>" verbatim, sem reimplementar a lógica — isso
# tira a corretude da serialização da mão do modelo (que poderia parafrasear o
# bash colado no prompt).
#
# Uso:
#   bash lock.sh acquire <lockdir> [timeout_s=1800] [max_wait_s=900]
#       Adquire o lock. Rouba (de forma ATÔMICA) locks órfãos mais velhos que
#       timeout_s. Desiste após max_wait_s de espera ativa. Sai 0 e imprime
#       LOCK_ACQUIRED ao adquirir; sai 2 e imprime LOCK_TIMEOUT ao desistir.
#   bash lock.sh release <lockdir>
#       Libera o lock. Idempotente — nunca falha se já liberado.
set -u

cmd="${1:-}"
lockdir="${2:-}"

if [ -z "$cmd" ] || [ -z "$lockdir" ]; then
  echo "USO: lock.sh <acquire|release> <lockdir> [timeout_s] [max_wait_s]" >&2
  exit 3
fi

case "$cmd" in
  acquire)
    timeout_s="${3:-1800}"
    max_wait_s="${4:-900}"
    mkdir -p "$(dirname "$lockdir")" 2>/dev/null
    waited=0
    while true; do
      if mkdir "$lockdir" 2>/dev/null; then
        date +%s > "$lockdir/acquired_at" 2>/dev/null
        echo "LOCK_ACQUIRED"
        exit 0
      fi
      # Lock ocupado — checa idade para eventual roubo de órfão.
      ts=$(cat "$lockdir/acquired_at" 2>/dev/null || stat -c %Y "$lockdir" 2>/dev/null || echo "")
      age=0
      if [ -n "$ts" ]; then age=$(( $(date +%s) - ts )); fi
      if [ "$age" -gt "$timeout_s" ]; then
        # Roubo ATÔMICO anti-TOCTOU: só quem cria o steal-marker remove o lock
        # órfão. Se dois processos veem idade>timeout ao mesmo tempo, só um
        # ganha o mkdir do steal-marker e faz o rm; o outro volta ao loop e
        # disputa o lock recriado normalmente.
        if mkdir "${lockdir}.steal" 2>/dev/null; then
          rm -rf "$lockdir"
          rmdir "${lockdir}.steal" 2>/dev/null
          continue
        fi
      fi
      if [ "$waited" -ge "$max_wait_s" ]; then
        echo "LOCK_TIMEOUT"
        exit 2
      fi
      sleep 5
      waited=$(( waited + 5 ))
    done
    ;;
  release)
    rm -rf "$lockdir" 2>/dev/null
    echo "LOCK_RELEASED"
    exit 0
    ;;
  *)
    echo "comando desconhecido: $cmd" >&2
    exit 3
    ;;
esac
