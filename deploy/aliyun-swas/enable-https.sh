#!/usr/bin/env bash
# Run as root after issuing the lumiere.love certificate with Certbot.
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
shared=/opt/yueji/shared
runtime="$shared/runtime.env"
backend="$shared/backend.env"
target="$shared/nginx.https.conf"
webroot="$shared/acme-webroot"
cert=/etc/letsencrypt/live/lumiere.love
test -s "$cert/fullchain.pem"
test -s "$cert/privkey.pem"
test -f "$script_dir/nginx.https.conf"
command -v certbot >/dev/null
image="$(docker inspect yueji-admin-1 --format '{{.Config.Image}}')"
config_files="$(docker inspect yueji-admin-1 --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}')"
IFS=, read -r -a configs <<< "$config_files"
[[ ${#configs[@]} -ge 1 && ${configs[0]} == /opt/yueji/releases/*/compose.yml ]] || exit 1
base="${configs[0]}"
compose=(docker compose --env-file "$runtime")
for config in "${configs[@]}"; do
  [[ -f $config && $config == /opt/yueji/* ]] || exit 1
  compose+=(-f "$config")
done
backup="$shared/backups/https-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$backup"
cp -p "$base" "$backup/compose.yml"
cp -p "$runtime" "$backup/runtime.env"
cp -p "$backend" "$backup/backend.env"
[[ ! -f $target ]] || cp -p "$target" "$backup/nginx.https.conf"
cp -p /etc/letsencrypt/renewal/lumiere.love.conf "$backup/renewal.conf"
chmod 600 "$backup"/*
printf 'BACKUP=%s\n' "$backup"
changed=0
rollback() {
  status=$?
  trap - ERR
  if [[ $changed == 1 ]]; then
    cp -p "$backup/compose.yml" "$base"
    cp -p "$backup/runtime.env" "$runtime"
    cp -p "$backup/backend.env" "$backend"
    if [[ -f $backup/nginx.https.conf ]]; then
      cp -p "$backup/nginx.https.conf" "$target"
    fi
    "${compose[@]}" up -d --no-deps admin || true
    systemctl restart yueji-backend.service || true
    echo "HTTPS_SETUP_ROLLED_BACK=$backup" >&2
  fi
  exit "$status"
}
trap rollback ERR
install -d -m 755 "$webroot/.well-known/acme-challenge"
# Validate in an ephemeral container before changing the serving container.
docker run --rm --network host \
  --mount "type=bind,src=$script_dir/nginx.https.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  --mount 'type=bind,src=/etc/letsencrypt,dst=/etc/letsencrypt,readonly' \
  --mount "type=bind,src=$webroot,dst=/var/www/acme,readonly" \
  "$image" nginx -t
changed=1
install -m 644 "$script_dir/nginx.https.conf" "$target"
python3 - "$base" "$runtime" "$backend" <<'PY'
import pathlib, re, sys
base, runtime, backend = map(pathlib.Path, sys.argv[1:])
text = base.read_text()
old = '      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro'
new = '      - ${YUEJI_NGINX_CONFIG:-./nginx.conf}:/etc/nginx/conf.d/default.conf:ro'
assert text.count(old) + text.count(new) == 1, 'Unexpected nginx bind mount'
text = text.replace(old, new)
for mount in ('/etc/letsencrypt:/etc/letsencrypt:ro',
              '/opt/yueji/shared/acme-webroot:/var/www/acme:ro'):
    if mount not in text:
        text = text.replace(new, new + '\n      - ' + mount)
base.write_text(text)
for path, values in (
    (runtime, {'PUBLIC_BASE_URL': 'https://lumiere.love',
               'YUEJI_NGINX_CONFIG': '/opt/yueji/shared/nginx.https.conf'}),
    (backend, {'OSS_MINIO_CUSTOM_DOMAIN': 'https://lumiere.love/files'}),
):
    text = path.read_text()
    for key, value in values.items():
        pattern = rf'^{key}=.*$'
        line = f'{key}={value}'
        text = re.sub(pattern, line, text, flags=re.M) if re.search(pattern, text, re.M) else text.rstrip() + '\n' + line + '\n'
    path.write_text(text)
    path.chmod(0o600)
PY
"${compose[@]}" config --quiet
"${compose[@]}" up -d --no-deps admin
docker exec yueji-admin-1 nginx -t
for host in lumiere.love www.lumiere.love; do
  curl --fail --silent --show-error --retry 8 --retry-connrefused --retry-delay 1 \
    --resolve "$host:443:127.0.0.1" "https://$host/healthz"
done
systemctl restart yueji-backend.service
ready=0
for attempt in $(seq 1 45); do
  if curl --fail --silent --show-error --resolve lumiere.love:443:127.0.0.1 \
      https://lumiere.love/prod-api/api/v1/auth/captcha >/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
[[ $ready == 1 ]]
# Serving HTTPS is now healthy; later renewal failures must not undo it.
trap - ERR
echo YUEJI_HTTPS_SERVING_OK
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/bin/sh' 'set -eu' \
  '/usr/bin/docker exec yueji-admin-1 nginx -t' \
  '/usr/bin/docker exec yueji-admin-1 nginx -s reload' \
  > /etc/letsencrypt/renewal-hooks/deploy/yueji-nginx
chmod 750 /etc/letsencrypt/renewal-hooks/deploy/yueji-nginx
# Certbot tests the new persistent challenge directory against staging, then saves it.
certbot reconfigure --cert-name lumiere.love --webroot-path "$webroot" --non-interactive
systemctl enable --now certbot.timer
/etc/letsencrypt/renewal-hooks/deploy/yueji-nginx
systemctl is-active certbot.timer
systemctl list-timers certbot.timer --no-pager
openssl x509 -in "$cert/fullchain.pem" -noout -dates -ext subjectAltName
echo YUEJI_HTTPS_AND_RENEWAL_OK
