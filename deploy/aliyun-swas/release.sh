#!/usr/bin/env bash
# Extend the existing SWAS bootstrap deployment; never run bootstrap or SQL here.
set -Eeuo pipefail
umask 022

component=${1:-}
operation=${2:-check}
release=${3:-}
checksum=${4:-}
upload=${5:-}
case "$component" in admin|backend) ;; *) echo 'Expected admin or backend' >&2; exit 2;; esac
case "$operation" in check|deploy|rollback) ;; *) echo 'Expected check, deploy or rollback' >&2; exit 2;; esac
[[ $EUID == 0 ]] || { echo 'Run with the existing server administrator account' >&2; exit 1; }

base=/opt/yueji
shared=$base/shared
current=$(readlink -e "$base/current")
[[ "$current" == "$base/releases/"* && -f "$current/compose.yml" ]]
[[ -f "$shared/runtime.env" && -f "$shared/backend.env" ]]
for command in docker systemctl curl python3 flock sha256sum tar runuser; do command -v "$command" >/dev/null; done
# Both repositories share this server lock, including rollback.
exec 9>/run/lock/yueji-release.lock
flock -w 600 9
compose=(docker compose --env-file "$shared/runtime.env" -f "$current/compose.yml")
"${compose[@]}" config --quiet
[[ $(systemctl show yueji-backend.service -p User --value) == yueji ]]

backend_health() {
  curl --fail --silent --show-error --max-time 10 \
    http://127.0.0.1/prod-api/api/v1/auth/captcha |
    python3 -I -c 'import json,sys; assert json.load(sys.stdin).get("code") == "00000"'
}
if [[ "$operation" != rollback ]]; then
  systemctl is-active --quiet yueji-backend.service
  backend_health
fi

if [[ "$component" == admin ]]; then
  config=$shared/ci-admin.override.yml
  container=$("${compose[@]}" ps -aq admin)
  [[ -n "$container" ]]
  active=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/usr/share/nginx/html"}}{{.Source}}{{end}}{{end}}' "$container")
  nginx_source=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/conf.d/default.conf"}}{{.Source}}{{end}}{{end}}' "$container")
  [[ $(readlink -e "$nginx_source") == "$current/nginx.conf" ]]
else
  config=/etc/systemd/system/yueji-backend.service.d/90-ci-release.conf
  active=$(systemctl show yueji-backend.service -p WorkingDirectory --value)
  # The build runner matches this runtime's Node major and Ubuntu 22.04 ABI.
  [[ $(uname -m) == x86_64 ]]
  . /etc/os-release
  [[ "$ID" == ubuntu && ${VERSION_ID%%.*} -ge 22 ]]
  [[ -x /opt/node-v22.23.2/bin/node ]]
  systemctl cat yueji-backend.service | grep -Fx 'ExecStart=/opt/node-v22.23.2/bin/node dist/main.js' >/dev/null
fi
[[ "$active" =~ ^/opt/yueji/(releases|ci-releases)/[A-Za-z0-9_./-]+$ && -d "$active" ]]
if [[ "$operation" == check ]]; then
  printf 'READY component=%s active=%s\n' "$component" "$active"
  exit 0
fi

state=$shared/ci-$component
install -d -m 700 "$state"
transaction=$(mktemp -d "$state/transaction.XXXXXXXX")
trap 'rm -rf -- "$transaction"' EXIT

write_config() {
  if [[ "$component" == admin ]]; then
    printf 'services:\n  admin:\n    volumes:\n      - "%s:/usr/share/nginx/html:ro"\n' "$1"
  else
    printf '[Service]\nWorkingDirectory=%s\n' "$1"
  fi
}
write_config "$active" > "$transaction/before"

apply_config() {
  install -d -m 755 "$(dirname "$config")" || return
  install -m 644 "$1" "$config.next" || return
  mv -fT "$config.next" "$config" || return
  if [[ "$component" == admin ]]; then
    "${compose[@]}" -f "$config" up -d --no-deps --force-recreate --pull never admin
  else
    systemctl daemon-reload || return
    systemctl restart yueji-backend.service
  fi
}

verify() {
  local attempt
  for attempt in {1..30}; do
    if [[ "$component" == admin ]]; then
      if curl --fail --silent --show-error --max-time 5 http://127.0.0.1/index.html -o "$transaction/index.html" &&
        cmp --silent "$transaction/index.html" "$1/index.html" && backend_health; then return 0; fi
    elif systemctl is-active --quiet yueji-backend.service && backend_health; then
      return 0
    fi
    sleep 2
  done
  return 1
}

restore() {
  trap - ERR HUP INT TERM
  set +e
  echo 'Release failed; restoring the previously running version' >&2
  if apply_config "$transaction/before" && verify "$active"; then
    echo 'Previous version restored' >&2
  else
    echo 'RESTORE FAILED: inspect the server immediately' >&2
  fi
  exit 1
}

if [[ "$operation" == rollback ]]; then
  [[ -s "$state/previous.conf" && -s "$state/previous.path" ]] || { echo 'No previous release recorded' >&2; exit 1; }
  target=$(cat "$state/previous.path")
  [[ "$target" =~ ^/opt/yueji/(releases|ci-releases)/[A-Za-z0-9_./-]+$ && -d "$target" ]]
  cp "$state/previous.conf" "$transaction/next"
else
  [[ "$release" =~ ^[0-9]+-[0-9]+-[0-9a-f]{40}$ && "$checksum" =~ ^[0-9a-f]{64}$ ]]
  [[ "$upload" =~ ^/tmp/yueji-ci\.[A-Za-z0-9]+$ && -d "$upload" && ! -L "$upload" ]]
  archive=$upload/release.tgz
  printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status
  destination=$base/ci-releases/$component/$release
  [[ ! -e "$destination" ]]
  # Reject archive traversal and external links before extraction.
  python3 -I - "$archive" "$component" <<'PY'
import pathlib, sys, tarfile
with tarfile.open(sys.argv[1], "r:gz") as archive:
    for member in archive:
        path = pathlib.PurePosixPath(member.name)
        assert not path.is_absolute() and ".." not in path.parts, member.name
        allowed = {"dist"} if sys.argv[2] == "admin" else {"dist", "node_modules", "package.json"}
        assert path.parts and path.parts[0] in allowed, member.name
        assert member.isfile() or member.isdir() or member.issym(), member.name
        if member.issym():
            target = pathlib.PurePosixPath(member.linkname)
            assert not target.is_absolute(), member.name
            depth = len(path.parent.parts)
            for part in target.parts:
                depth += -1 if part == ".." else 0 if part == "." else 1
                assert depth >= 0, member.name
PY
  available=$(df -Pk "$base" | awk 'NR==2 {print $4}')
  required=$(python3 -I - "$archive" <<'PY'
import sys, tarfile
with tarfile.open(sys.argv[1], "r:gz") as archive:
    print(sum(member.size for member in archive) // 1024 + 524288)
PY
  )
  (( available > required )) || { echo 'Insufficient disk space; retain current/previous versions when cleaning old releases' >&2; exit 1; }
  install -d -m 755 "$(dirname "$destination")"
  install -d -o yueji -g yueji -m 755 "$destination"
  runuser -u yueji -- tar --extract --gzip --file - --directory "$destination" --no-same-owner --no-same-permissions < "$archive"
  if [[ "$component" == admin ]]; then
    target=$destination/dist
    [[ -s "$target/index.html" ]]
  else
    target=$destination
    [[ -s "$target/dist/main.js" && -d "$target/node_modules" ]]
    runuser -u yueji -- mkdir -m 750 "$target/logs"
  fi
  write_config "$target" > "$transaction/next"
fi

trap restore ERR HUP INT TERM
apply_config "$transaction/next"
verify "$target"
# One extra check catches a service which dies just after accepting requests.
sleep 5
verify "$target"
cp "$transaction/before" "$state/previous.conf"
printf '%s\n' "$active" > "$state/previous.path"
trap - ERR HUP INT TERM
printf 'RELEASE_OK component=%s operation=%s active=%s\n' "$component" "$operation" "$target"
# ponytail: releases are retained for rollback; prune inactive releases when disk usage grows.
