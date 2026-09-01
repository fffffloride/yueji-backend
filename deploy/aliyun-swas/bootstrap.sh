#!/usr/bin/env bash
set -Eeuo pipefail

BACKEND_COMMIT="d23c0f782f0e8bc4c8e40f12720b54b36dd5076f"
BACKEND_TREE="b90fca925406c16629982b0b72019fa4fe82295f"
OSS_COMMIT="bb13caec4cae77d37e7ba8094ac773cdd53ae52e"
# GitHub's source archive omits three .vscode snippet files. The remaining 305
# tracked build/runtime files are verified separately and produce this tree.
OSS_TREE="3bd69f9a0579aee4c05090f6eca34588dc5daef2"
GITHUB_MIRROR="https://ghfast.top/https://github.com/fffffloride"
MC_VERSION="RELEASE.2025-08-13T08-35-41Z"
MC_SHA256="01f866e9c5f9b87c2b09116fa5d7c06695b106242d829a8bb32990c00312e891"
NODE_VERSION="v22.23.2"
NODE_SHA256="d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307"
NODE_DIR="/opt/node-${NODE_VERSION}"
DEPLOY_PAYLOAD="/tmp/yueji-deploy-config.tgz"
SHARED_DIR="/opt/yueji/shared"
RUNTIME_ENV="${SHARED_DIR}/runtime.env"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="/opt/yueji/releases/${RELEASE_ID}"

export DEBIAN_FRONTEND=noninteractive
mkdir -p /var/log
exec > >(tee -a /var/log/yueji-deploy.log) 2>&1

if [[ ! -f "${DEPLOY_PAYLOAD}" ]]; then
  echo "缺少部署配置包：${DEPLOY_PAYLOAD}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y docker.io docker-compose-v2 ca-certificates curl git openssl
  systemctl enable --now docker
fi

if [[ -z "$(swapon --show --noheadings)" ]]; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi

mkdir -p "${RELEASE_DIR}" "${SHARED_DIR}"

download_and_verify() {
  local repo_name="$1"
  local commit="$2"
  local expected_tree="$3"
  local destination="${RELEASE_DIR}/${repo_name}"
  local archive="/tmp/${repo_name}-${RELEASE_ID}.tar.gz"

  curl -4 --fail --location --retry 3 --retry-all-errors \
    --connect-timeout 20 --max-time 300 \
    "${GITHUB_MIRROR}/${repo_name}/archive/${commit}.tar.gz" \
    --output "${archive}"

  mkdir -p "${destination}"
  tar -xzf "${archive}" --strip-components=1 -C "${destination}"

  (
    cd "${destination}"
    git init --quiet
    git add --all
    local actual_tree
    actual_tree="$(git write-tree)"
    if [[ "${actual_tree}" != "${expected_tree}" ]]; then
      echo "${repo_name} 源码校验失败：${actual_tree}" >&2
      exit 1
    fi
  )
}

download_and_verify "yueji-backend" "${BACKEND_COMMIT}" "${BACKEND_TREE}"
download_and_verify "yueji-oss" "${OSS_COMMIT}" "${OSS_TREE}"

# 同步阶段 5 单例积分规则表的主键修正；仅修改该表，避免误伤其他自增主键。
sed -i '/CREATE TABLE `marketing_points_rule` (/,/ENGINE=InnoDB/ s/`id` bigint NOT NULL AUTO_INCREMENT,/`id` bigint NOT NULL,/' \
  "${RELEASE_DIR}/yueji-backend/sql/mysql/biz_phase5.sql"
sed -i '/CREATE TABLE `marketing_points_rule` (/,/ENGINE=InnoDB/ s/`id` bigint NOT NULL AUTO_INCREMENT,/`id` bigint NOT NULL,/' \
  "${RELEASE_DIR}/yueji-backend/sql/mysql/marketing_hardening.sql"

# pnpm 9 requires an explicit workspace package list. Both repositories use
# pnpm-workspace.yaml only for allowBuilds, so make the repository root explicit.
for workspace_file in \
  "${RELEASE_DIR}/yueji-backend/pnpm-workspace.yaml" \
  "${RELEASE_DIR}/yueji-oss/pnpm-workspace.yaml"; do
  sed -i '1i packages:\n  - "."' "${workspace_file}"
done

tar -xzf "${DEPLOY_PAYLOAD}" -C "${RELEASE_DIR}"

if [[ ! -f "${RUNTIME_ENV}" ]]; then
  umask 077
  mysql_root_password="$(openssl rand -hex 24)"
  mysql_app_password="$(openssl rand -hex 24)"
  redis_password="$(openssl rand -hex 24)"
  minio_access_key="yueji$(openssl rand -hex 10)"
  minio_secret_key="$(openssl rand -hex 32)"
  jwt_secret_key="$(openssl rand -base64 48 | tr -d '\n')"

  {
    printf 'PUBLIC_BASE_URL=http://47.100.53.222\n'
    printf 'MYSQL_ROOT_PASSWORD=%s\n' "${mysql_root_password}"
    printf 'MYSQL_APP_PASSWORD=%s\n' "${mysql_app_password}"
    printf 'REDIS_PASSWORD=%s\n' "${redis_password}"
    printf 'MINIO_ACCESS_KEY=%s\n' "${minio_access_key}"
    printf 'MINIO_SECRET_KEY=%s\n' "${minio_secret_key}"
    printf 'JWT_SECRET_KEY=%s\n' "${jwt_secret_key}"
    printf 'WX_MINIAPP_APP_ID=\n'
    printf 'WX_MINIAPP_APP_SECRET=\n'
  } > "${RUNTIME_ENV}"
  chmod 600 "${RUNTIME_ENV}"
fi

set -a
# shellcheck disable=SC1090
source "${RUNTIME_ENV}"
set +a

BACKEND_ENV="${SHARED_DIR}/backend.env"
umask 077
{
  printf 'NODE_ENV=prod\n'
  printf 'APP_PORT=8000\n'
  printf 'SESSION_TYPE=jwt\n'
  printf 'MOCK_LOGIN_ENABLED=false\n'
  printf 'SWAGGER_ENABLED=false\n'
  printf 'PAYMENT_DRIVER=wechat\n'
  printf 'MYSQL_HOST=127.0.0.1\n'
  printf 'MYSQL_PORT=3306\n'
  printf 'MYSQL_USER=yueji\n'
  printf 'MYSQL_PASSWORD=%s\n' "${MYSQL_APP_PASSWORD}"
  printf 'MYSQL_DB=youlai_admin\n'
  printf 'TYPEORM_LOGGING=false\n'
  printf 'REDIS_HOST=127.0.0.1\n'
  printf 'REDIS_PORT=6379\n'
  printf 'REDIS_DB=0\n'
  printf 'REDIS_PASSWORD=%s\n' "${REDIS_PASSWORD}"
  printf 'REDIS_PREFIX=yueji:\n'
  printf 'JWT_SECRET_KEY=%s\n' "${JWT_SECRET_KEY}"
  printf 'JWT_EXPIRES_IN=7200\n'
  printf 'JWT_ISSUER=yueji\n'
  printf 'ORDER_PAY_TIMEOUT_MINUTES=30\n'
  printf 'OSS_TYPE=minio\n'
  printf 'OSS_MINIO_ENDPOINT=http://127.0.0.1:9000\n'
  printf 'OSS_MINIO_ACCESS_KEY=%s\n' "${MINIO_ACCESS_KEY}"
  printf 'OSS_MINIO_SECRET_KEY=%s\n' "${MINIO_SECRET_KEY}"
  printf 'OSS_MINIO_BUCKET=public\n'
  printf 'OSS_MINIO_CUSTOM_DOMAIN=http://47.100.53.222/files\n'
  printf 'OSS_UPLOAD_MAX_SIZE=52428800\n'
  printf 'OSS_UPLOAD_ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp\n'
  printf 'WX_MINIAPP_APP_ID=%s\n' "${WX_MINIAPP_APP_ID:-}"
  printf 'WX_MINIAPP_APP_SECRET=%s\n' "${WX_MINIAPP_APP_SECRET:-}"
} > "${BACKEND_ENV}"
chmod 600 "${BACKEND_ENV}"
umask 022

node_archive="/tmp/node-${NODE_VERSION}-linux-x64.tar.xz"
if [[ ! -x "${NODE_DIR}/bin/node" ]]; then
  if [[ ! -f "${node_archive}" ]] || ! echo "${NODE_SHA256}  ${node_archive}" | sha256sum --check --status; then
    curl -4 --fail --location --retry 3 --retry-all-errors \
      --connect-timeout 20 --max-time 300 \
      "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz" \
      --output "${node_archive}.download"
    echo "${NODE_SHA256}  ${node_archive}.download" | sha256sum --check
    mv "${node_archive}.download" "${node_archive}"
  fi
  mkdir -p "${NODE_DIR}"
  tar -xJf "${node_archive}" --strip-components=1 -C "${NODE_DIR}"
fi

export PATH="${NODE_DIR}/bin:${PATH}"
npm install --global pnpm@9.15.9 --registry=https://registry.npmmirror.com/

export HUSKY=0
cd "${RELEASE_DIR}/yueji-backend"
pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com/
pnpm build
mkdir -p logs

cd "${RELEASE_DIR}/yueji-oss"
pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com/
pnpm build

cd "${RELEASE_DIR}"
docker compose --env-file "${RUNTIME_ENV}" -f compose.yml config --quiet
docker compose --env-file "${RUNTIME_ENV}" -f compose.yml up -d mysql redis minio admin

mc_binary="${SHARED_DIR}/mc-${MC_VERSION}"
if [[ ! -f "${mc_binary}" ]] || ! echo "${MC_SHA256}  ${mc_binary}" | sha256sum --check --status; then
  curl -4 --fail --location --retry 3 --retry-all-errors \
    --connect-timeout 20 --max-time 300 \
    "https://ghfast.top/https://github.com/minio/mc/releases/download/${MC_VERSION}/mc.linux-amd64.${MC_VERSION}" \
    --output "${mc_binary}.download"
  echo "${MC_SHA256}  ${mc_binary}.download" | sha256sum --check
  mv "${mc_binary}.download" "${mc_binary}"
  chmod 700 "${mc_binary}"
fi

until "${mc_binary}" alias set yueji http://127.0.0.1:9000 \
  "$(sed -n 's/^MINIO_ACCESS_KEY=//p' "${RUNTIME_ENV}")" \
  "$(sed -n 's/^MINIO_SECRET_KEY=//p' "${RUNTIME_ENV}")"; do
  sleep 1
done
"${mc_binary}" mb --ignore-existing yueji/public
"${mc_binary}" anonymous set download yueji/public

if ! id yueji >/dev/null 2>&1; then
  useradd --system --home-dir /opt/yueji --shell /usr/sbin/nologin yueji
fi
chown -R yueji:yueji "${RELEASE_DIR}/yueji-backend/logs"

cat > /etc/systemd/system/yueji-backend.service <<EOF
[Unit]
Description=Yueji NestJS Backend
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=simple
User=yueji
Group=yueji
WorkingDirectory=${RELEASE_DIR}/yueji-backend
EnvironmentFile=${BACKEND_ENV}
ExecStart=${NODE_DIR}/bin/node dist/main.js
Restart=always
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now yueji-backend.service
systemctl restart yueji-backend.service

backend_ready="false"
for _ in $(seq 1 90); do
  if curl --fail --silent --show-error \
    http://127.0.0.1:8000/api/v1/auth/captcha >/dev/null; then
    backend_ready="true"
    break
  fi
  sleep 2
done

if [[ "${backend_ready}" != "true" ]]; then
  docker compose --env-file "${RUNTIME_ENV}" -f compose.yml ps
  journalctl --no-pager --unit yueji-backend.service --lines=200
  exit 1
fi

curl --fail --silent --show-error http://127.0.0.1/healthz
ln -sfn "${RELEASE_DIR}" /opt/yueji/current
docker compose --env-file "${RUNTIME_ENV}" -f compose.yml ps
systemctl --no-pager --full status yueji-backend.service
echo "YUEJI_DEPLOY_OK ${RELEASE_ID}"
