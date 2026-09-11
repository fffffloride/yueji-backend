#!/bin/bash
# Extend the existing SWAS bootstrap deployment; never run bootstrap or SQL here.
set -Eeuo pipefail
umask 022
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
cd /

component=${1:-}
operation=${2:-check}
release=${3:-}
checksum=${4:-}
upload=${5:-}
[[ $# == 5 ]] || exit 2
case "$component" in admin|backend) ;; *) echo 'Expected admin or backend' >&2; exit 2;; esac
case "$operation" in check|deploy|rollback) ;; *) echo 'Expected check, deploy or rollback' >&2; exit 2;; esac
[[ $EUID == 0 && ${SUDO_USER:-root} == @(root|yueji-deploy) ]] || exit 1
if [[ "$operation" != deploy ]]; then
  [[ -z "$release$checksum$upload" ]] || exit 2
fi
ops=/usr/local/lib/yueji-release
[[ -f "$ops/backup.py" && -f "$ops/verify-backup.py" && -f "$ops/upload.cjs" ]]

base=/opt/yueji
shared=$base/shared
current=$(readlink -e "$base/current")
[[ "$current" == "$base/releases/"* && -f "$current/compose.yml" ]]
[[ -f "$shared/runtime.env" && -f "$shared/backend.env" ]]
for command in docker systemctl curl python3 flock sha256sum tar runuser getent; do command -v "$command" >/dev/null; done
release_uid=$(id -u yueji-release)
[[ $release_uid -ne 0 && $release_uid -ne $(id -u yueji) ]]
[[ $(getent passwd yueji-release | cut -d: -f7) == /usr/sbin/nologin ]]
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
  python3 -I "$ops/backup.py" --preflight
  [[ -s /root/yueji-backup-ops-20260910/oss.json ]]
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
  [[ -s "$state/previous.path" ]] || { echo 'No previous release recorded' >&2; exit 1; }
  target=$(cat "$state/previous.path")
  [[ "$target" =~ ^/opt/yueji/(releases|ci-releases)/[A-Za-z0-9_./-]+$ && -d "$target" ]]
  write_config "$target" > "$transaction/next"
else
  [[ "$release" =~ ^[0-9]+-[0-9]+-[0-9a-f]{40}$ && "$checksum" =~ ^[0-9a-f]{64}$ ]]
  [[ "$upload" =~ ^/home/yueji-deploy/staging/release\.[A-Za-z0-9]+$ ]]
  # Snapshot the untrusted upload into a root-only transaction before validation.
  python3 -I - "$upload" "$transaction/release.tgz" <<'PY'
import os, pwd, stat, sys
directory = os.open(sys.argv[1], os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
try:
    assert os.fstat(directory).st_uid == pwd.getpwnam('yueji-deploy').pw_uid
    fd = os.open('release.tgz', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    with os.fdopen(fd, 'rb') as source, open(sys.argv[2], 'xb') as target:
        info = os.fstat(source.fileno())
        assert stat.S_ISREG(info.st_mode) and info.st_size <= 1024**3
        remaining = 1024**3
        while chunk := source.read(min(1024**2, remaining + 1)):
            remaining -= len(chunk)
            assert remaining >= 0, 'Artifact exceeds 1 GiB'
            target.write(chunk)
finally:
    os.close(directory)
PY
  archive=$transaction/release.tgz
  printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status
  destination=$base/ci-releases/$component/$release
  [[ ! -e "$destination" ]]
  # Reject unexpected paths, duplicate entries and special files before extraction.
  python3 -I - "$archive" "$component" <<'PY'
import pathlib, sys, tarfile
with tarfile.open(sys.argv[1], "r:gz") as archive:
    names = set()
    size = 0
    for member in archive:
        path = pathlib.PurePosixPath(member.name)
        assert not path.is_absolute() and ".." not in path.parts, member.name
        allowed = {"dist"} if sys.argv[2] == "admin" else {"dist", "node_modules", "package.json"}
        assert path.parts and path.parts[0] in allowed, member.name
        assert path not in names, member.name
        names.add(path)
        size += member.size
        assert len(names) <= 200000 and size <= 4 * 1024**3, 'Artifact too large'
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
  install -d -o yueji-release -g yueji-release -m 755 "$destination"
  # Python's data filter resolves symlink chains; extraction has no root privileges.
  runuser -u yueji-release -- python3 -I -c 'import sys,tarfile; tarfile.open(fileobj=sys.stdin.buffer, mode="r|gz").extractall(sys.argv[1], filter="data")' "$destination" < "$archive"
  if [[ "$component" == admin ]]; then
    target=$destination/dist
    [[ -s "$target/index.html" ]]
  else
    target=$destination
    [[ -s "$target/dist/main.js" && -d "$target/node_modules" ]]
  fi
  chown -hR root:root "$destination"
  if [[ "$component" == backend ]]; then
    install -d -o yueji -g yueji -m 750 "$target/logs"
  fi
  write_config "$target" > "$transaction/next"
  # No version switch unless this release has a fresh, restorable off-server backup.
  python3 -I "$ops/backup.py" --run > "$transaction/backup.log"
  backup=$(tail -n 1 "$transaction/backup.log" | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["local_backup"])')
  printf 'BACKUP_LOCAL=%s\n' "$backup"
  python3 -I "$ops/verify-backup.py" "$backup"
  /opt/node-v22.23.2/bin/node "$ops/upload.cjs" "$backup"
  printf '%s\n' "$backup" > "$state/last-backup.path"
fi

trap restore ERR HUP INT TERM
apply_config "$transaction/next"
verify "$target"
# One extra check catches a service which dies just after accepting requests.
sleep 5
verify "$target"
printf '%s\n' "$active" > "$transaction/previous.path"
mv -fT "$transaction/previous.path" "$state/previous.path"
trap - ERR HUP INT TERM
printf 'RELEASE_OK component=%s operation=%s active=%s\n' "$component" "$operation" "$target"
# ponytail: releases are retained for rollback; prune inactive releases when disk usage grows.
