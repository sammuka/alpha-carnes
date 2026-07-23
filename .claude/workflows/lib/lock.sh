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
#   bash lock.sh acquire <lockdir> <owner_token> [timeout_s=1800] [max_wait_s=900]
#       Adquire o lock. Rouba (de forma ATÔMICA) locks órfãos mais velhos que
#       timeout_s. Desiste após max_wait_s de espera ativa. Sai 0 e imprime
#       LOCK_ACQUIRED ao adquirir; sai 2 e imprime LOCK_TIMEOUT ao desistir.
#   bash lock.sh release <lockdir> <owner_token>
#       Libera somente o lock pertencente ao token informado. Se outro processo
#       for o dono, retorna LOCK_NOT_OWNER sem remover nada.
set -u

cmd="${1:-}"
lockdir="${2:-}"
owner_token="${3:-}"

if [ -z "$cmd" ] || [ -z "$lockdir" ] || [ -z "$owner_token" ]; then
  echo "USO: lock.sh <acquire|release> <lockdir> <owner_token> [timeout_s] [max_wait_s]" >&2
  exit 3
fi

case "$cmd" in
  acquire)
    timeout_s="${4:-1800}"
    max_wait_s="${5:-900}"
    mkdir -p "$(dirname "$lockdir")" 2>/dev/null
    waited=0
    while true; do
      steal_guard="${lockdir}.steal"
      if [ -d "$steal_guard" ]; then
        guard_ts=$(stat -c %Y "$steal_guard" 2>/dev/null || echo "")
        guard_age=0
        if [ -n "$guard_ts" ]; then guard_age=$(( $(date +%s) - guard_ts )); fi
        if [ "$guard_age" -gt 30 ]; then
          guard_quarantine="${steal_guard}.orphan.$$.$(date +%s)"
          if mv "$steal_guard" "$guard_quarantine" 2>/dev/null; then
            rm -rf "$guard_quarantine"
          fi
        fi
      fi
      if [ ! -d "$steal_guard" ] && mkdir "$lockdir" 2>/dev/null; then
        printf '%s\n' "$owner_token" > "$lockdir/owner_token"
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
        if mkdir "$steal_guard" 2>/dev/null; then
          current_ts=$(cat "$lockdir/acquired_at" 2>/dev/null || stat -c %Y "$lockdir" 2>/dev/null || echo "")
          current_age=0
          if [ -n "$current_ts" ]; then current_age=$(( $(date +%s) - current_ts )); fi
          if [ -d "$lockdir" ] && [ "$current_age" -gt "$timeout_s" ]; then
            quarantine="${lockdir}.stale.$$.$(date +%s)"
            if mv "$lockdir" "$quarantine" 2>/dev/null; then
              rm -rf "$quarantine"
            fi
          fi
          rmdir "$steal_guard" 2>/dev/null
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
    if [ ! -d "$lockdir" ]; then
      echo "LOCK_ALREADY_RELEASED"
      exit 0
    fi
    actual_owner=$(cat "$lockdir/owner_token" 2>/dev/null || echo "")
    if [ "$actual_owner" != "$owner_token" ]; then
      echo "LOCK_NOT_OWNER"
      exit 4
    fi
    quarantine="${lockdir}.release.$$.$(date +%s)"
    if ! mv "$lockdir" "$quarantine" 2>/dev/null; then
      echo "LOCK_RELEASE_RACE"
      exit 5
    fi
    moved_owner=$(cat "$quarantine/owner_token" 2>/dev/null || echo "")
    if [ "$moved_owner" != "$owner_token" ]; then
      if [ ! -e "$lockdir" ]; then mv "$quarantine" "$lockdir" 2>/dev/null; fi
      echo "LOCK_NOT_OWNER"
      exit 4
    fi
    rm -rf "$quarantine"
    echo "LOCK_RELEASED"
    exit 0
    ;;
  *)
    echo "comando desconhecido: $cmd" >&2
    exit 3
    ;;
esac
