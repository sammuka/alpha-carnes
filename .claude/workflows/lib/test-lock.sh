#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
lock_script="$script_dir/lock.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

bash -n "$lock_script"

lock="$test_root/ownership.lock"
test "$(bash "$lock_script" acquire "$lock" owner-a 0)" = "LOCK_ACQUIRED"
# Idade nunca autoriza roubo automático de um dono possivelmente vivo.
printf '%s\n' "$(( $(date +%s) - 999999 ))" > "$lock/acquired_at"
set +e
output="$(bash "$lock_script" acquire "$lock" owner-b 0)"
code=$?
set -e
test "$code" -eq 2
test "$output" = "LOCK_TIMEOUT"
test ! -e "$lock/owner_token"
stored_hash="$(cat "$lock/owner_token_hash")"
test "$stored_hash" != "owner-a"

# Ler tudo que o lock persiste não fornece um token reutilizável.
set +e
output="$(bash "$lock_script" release "$lock" "$stored_hash")"
code=$?
set -e
test "$code" -eq 4
test "$output" = "LOCK_NOT_OWNER"

set +e
output="$(bash "$lock_script" release "$lock" owner-b)"
code=$?
set -e
test "$code" -eq 4
test "$output" = "LOCK_NOT_OWNER"
test "$(cat "$lock/owner_token_hash")" = "$stored_hash"
test "$(bash "$lock_script" release "$lock" owner-a)" = "LOCK_RELEASED"

stress_lock="$test_root/stress.lock"
for index in 1 2 3 4 5 6 7 8; do
  (
    set +e
    output="$(bash "$lock_script" acquire "$stress_lock" "owner-$index" 0 2>&1)"
    code=$?
    set -e
    printf '%s:%s:%s\n' "$index" "$code" "$output" >> "$test_root/results"
    if [ "$code" -eq 0 ]; then
      sleep 1
      bash "$lock_script" release "$stress_lock" "owner-$index" >> "$test_root/releases"
    fi
  ) &
done
wait

acquired="$(grep -c ':0:LOCK_ACQUIRED' "$test_root/results" || true)"
timed_out="$(grep -c ':2:LOCK_TIMEOUT' "$test_root/results" || true)"
test "$acquired" -eq 1
test "$timed_out" -eq 7
test "$(cat "$test_root/releases")" = "LOCK_RELEASED"

printf 'LOCK_TEST_OK acquired=%s timed_out=%s\n' "$acquired" "$timed_out"
