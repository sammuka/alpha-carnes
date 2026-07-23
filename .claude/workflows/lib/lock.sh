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
#   bash lock.sh acquire <lockdir> <owner_token> [max_wait_s=900]
#       Adquire o lock sem jamais roubar um dono apenas por idade. Desiste após
#       max_wait_s de espera ativa. Lock órfão exige recuperação explícita fora
#       deste script, depois de provar que não existe execução ativa. Sai 0 e
#       imprime LOCK_ACQUIRED; sai 2 e imprime LOCK_TIMEOUT.
#   bash lock.sh release <lockdir> <owner_token>
#       Libera somente o lock pertencente ao token informado. Se outro processo
#       for o dono, retorna LOCK_NOT_OWNER sem remover nada.
set -u
umask 077

hash_token() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
  else
    printf '%s' "$1" | openssl dgst -sha256 | awk '{print $NF}'
  fi
}

cmd="${1:-}"
lockdir="${2:-}"
owner_token="${3:-}"

if [ -z "$cmd" ] || [ -z "$lockdir" ] || [ -z "$owner_token" ]; then
  echo "USO: lock.sh <acquire|release> <lockdir> <owner_token> [max_wait_s]" >&2
  exit 3
fi

case "$cmd" in
  acquire)
    max_wait_s="${4:-900}"
    mkdir -p "$(dirname "$lockdir")" 2>/dev/null
    waited=0
    while true; do
      if mkdir "$lockdir" 2>/dev/null; then
        # Nunca persista o bearer token. Processos concorrentes podem ler o
        # diretório compartilhado; somente o hash é suficiente para validar
        # release sem entregar a credencial do dono.
        hash_token "$owner_token" > "$lockdir/owner_token_hash"
        date +%s > "$lockdir/acquired_at" 2>/dev/null
        echo "LOCK_ACQUIRED"
        exit 0
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
    actual_owner_hash=$(cat "$lockdir/owner_token_hash" 2>/dev/null || echo "")
    requested_owner_hash=$(hash_token "$owner_token")
    if [ "$actual_owner_hash" != "$requested_owner_hash" ]; then
      echo "LOCK_NOT_OWNER"
      exit 4
    fi
    quarantine="${lockdir}.release.$$.$(date +%s)"
    if ! mv "$lockdir" "$quarantine" 2>/dev/null; then
      echo "LOCK_RELEASE_RACE"
      exit 5
    fi
    moved_owner_hash=$(cat "$quarantine/owner_token_hash" 2>/dev/null || echo "")
    if [ "$moved_owner_hash" != "$requested_owner_hash" ]; then
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
