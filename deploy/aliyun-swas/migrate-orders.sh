#!/usr/bin/env bash
# One-off, data-preserving migration for the existing production database.
# Upload with the three SQL files named below from sql/mysql/.
set -Eeuo pipefail
umask 077
[[ $EUID == 0 ]] || exit 1
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for file in order_gifting.sql friend_payment.sql appointment_lifecycle_preserve.sql; do test -s "$script_dir/$file"; done
production=yueji-mysql-1
service=yueji-backend.service
backup="/opt/yueji/shared/backups/order-schema-$(date -u +%Y%m%dT%H%M%SZ)"
scratch="yueji-order-rehearsal-$(date +%s)-$$"
paused=0
scratch_created=0
exec 9>/run/lock/yueji-release.lock
flock -w 120 9
systemctl is-active --quiet "$service"
[[ $(df -Pk /opt/yueji | awk 'NR==2 {print $4}') -gt 1048576 ]]
install -d -m 700 "$backup"
cleanup() {
  result=$?
  trap - EXIT
  if [[ $paused == 1 ]]; then
    systemctl start "$service" || result=1
  fi
  if [[ $scratch_created == 1 ]]; then
    docker rm -f "$scratch" >/dev/null || result=1
  fi
  if [[ $result != 0 ]]; then
    echo "MIGRATION_STOPPED backup=$backup (no automatic production restore)" >&2
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
sql() {
  docker exec -i "$1" sh -c \
    ': "${MYSQL_ROOT_PASSWORD:?}"; export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --batch --skip-column-names --default-character-set=utf8mb4 youlai_admin'
}
dump() {
  docker exec "$production" sh -c \
    ': "${MYSQL_ROOT_PASSWORD:?}"; export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump -uroot --single-transaction --quick --routines --events --triggers --hex-blob --no-tablespaces --set-gtid-purged=OFF --databases youlai_admin' \
    | gzip > "$1"
  gzip -t "$1"
  sha256sum "$1" > "$1.sha256"
}
inventory() {
  local query
  query=$(printf '%s\n' "SET SESSION group_concat_max_len=1000000; SELECT GROUP_CONCAT(CONCAT('SELECT ',QUOTE(TABLE_NAME),',COUNT(*) FROM ',CHAR(96),TABLE_NAME,CHAR(96)) ORDER BY TABLE_NAME SEPARATOR ' UNION ALL ') FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME REGEXP '^[a-zA-Z0-9_]+$';" | sql "$1")
  printf '%s;\n' "$query" | sql "$1"
}
preflight() {
  local invalid
  invalid=$(sql "$1" <<'SQL'
SELECT
 (SELECT COUNT(*) FROM biz_order o LEFT JOIN member m ON m.id=o.member_id WHERE m.id IS NULL) +
 (SELECT COUNT(*) FROM biz_payment p LEFT JOIN member m ON m.id=p.member_id WHERE m.id IS NULL) +
 (SELECT COUNT(*) FROM (SELECT order_id FROM biz_payment WHERE status IN (1,3) AND is_deleted=0 GROUP BY order_id HAVING COUNT(*)>1) x) +
 (SELECT COUNT(*) FROM (SELECT order_id FROM biz_payment WHERE status=0 AND is_deleted=0 GROUP BY order_id HAVING COUNT(*)>1) x) +
 (SELECT COUNT(*) FROM (SELECT payment_id FROM biz_refund GROUP BY payment_id HAVING COUNT(*)>1) x) +
 (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND ENGINE<>'InnoDB');
SQL
  )
  [[ $invalid == 0 ]]
}
migrate() {
  for file in order_gifting.sql friend_payment.sql appointment_lifecycle_preserve.sql; do
    { printf 'SET SESSION lock_wait_timeout=30; SET SESSION innodb_lock_wait_timeout=30;\n'; cat "$script_dir/$file"; } | sql "$1"
  done
  local invalid
  invalid=$(sql "$1" <<'SQL'
SELECT
 (SELECT COUNT(*) FROM biz_order o LEFT JOIN member m ON m.id=o.beneficiary_member_id WHERE o.beneficiary_member_id IS NULL OR m.id IS NULL) +
 (SELECT COUNT(*) FROM biz_payment p LEFT JOIN member m ON m.id=p.payer_member_id WHERE p.payer_member_id IS NULL OR m.id IS NULL) +
 (SELECT COUNT(*) FROM biz_order o LEFT JOIN biz_payment p ON p.id=o.paid_payment_id WHERE o.paid_payment_id IS NOT NULL AND (p.id IS NULL OR p.order_id<>o.id OR p.status NOT IN (1,3)));
SELECT COUNT(*) FROM biz_order_gift;
SELECT COUNT(*) FROM biz_proxy_pay_share;
SQL
  )
  [[ ${invalid%%$'\n'*} == 0 ]]
}
preflight "$production"
dump "$backup/rehearsal.sql.gz"
image=$(docker inspect "$production" --format '{{.Image}}')
scratch_created=1
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24) docker run --detach --name "$scratch" \
  --network none --memory 1g --memory-swap 1g \
  --tmpfs /var/lib/mysql:rw,nosuid,size=512m \
  --tmpfs /var/run/mysqld:rw,nosuid,size=16m \
  --env MYSQL_ROOT_PASSWORD "$image" \
  --innodb-buffer-pool-size=64M --performance-schema=OFF --skip-log-bin >/dev/null
ready=0
for attempt in $(seq 1 90); do
  if docker exec "$scratch" sh -c 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql --protocol=TCP -h127.0.0.1 -uroot -N -e "SELECT 1"' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ $ready == 1 ]]
gzip -dc "$backup/rehearsal.sql.gz" | docker exec -i "$scratch" sh -c \
  'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --default-character-set=utf8mb4'
inventory "$scratch" > "$backup/rehearsal-before.tsv"
preflight "$scratch"
migrate "$scratch"
migrate "$scratch"
echo ORDER_MIGRATION_REHEARSAL_OK
inventory "$scratch" > "$backup/rehearsal-after.tsv"
# Match all pre-existing table row counts, allowing newly introduced tables.
awk 'NR==FNR {counts[$1]=$2;next} $1 in counts {if(counts[$1]!=$2) exit 1;delete counts[$1]} END {if(length(counts)) exit 1}' \
  "$backup/rehearsal-before.tsv" "$backup/rehearsal-after.tsv"
docker rm -f "$scratch" >/dev/null
scratch_created=0
paused=1
systemctl stop "$service"
preflight "$production"
dump "$backup/database-before-migration.sql.gz"
inventory "$production" > "$backup/before.tsv"
cp "$script_dir/order_gifting.sql" "$script_dir/friend_payment.sql" "$script_dir/appointment_lifecycle_preserve.sql" "$backup/"
migrate "$production"
inventory "$production" > "$backup/after.tsv"
awk 'NR==FNR {counts[$1]=$2;next} $1 in counts {if(counts[$1]!=$2) exit 1;delete counts[$1]} END {if(length(counts)) exit 1}' \
  "$backup/before.tsv" "$backup/after.tsv"
systemctl start "$service"
paused=0
ready=0
for attempt in $(seq 1 45); do
  if curl --fail --silent --show-error --max-time 5 \
      --resolve lumiere.love:443:127.0.0.1 \
      https://lumiere.love/prod-api/api/v1/auth/captcha \
      | python3 -c 'import json,sys; assert json.load(sys.stdin).get("code") == "00000"' 2>/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
[[ $ready == 1 ]]
sql "$production" <<'SQL'
SELECT 'orders',COUNT(*) FROM biz_order UNION ALL SELECT 'payments',COUNT(*) FROM biz_payment UNION ALL SELECT 'refunds',COUNT(*) FROM biz_refund;
SELECT 'missing_beneficiaries',COUNT(*) FROM biz_order WHERE beneficiary_member_id IS NULL;
SELECT 'missing_payers',COUNT(*) FROM biz_payment WHERE payer_member_id IS NULL;
SELECT 'linked_paid_orders',COUNT(*) FROM biz_order WHERE paid_payment_id IS NOT NULL;
SELECT 'appointments',COUNT(*) FROM appointment;
SQL
echo "ORDER_SCHEMA_MIGRATION_OK backup=$backup"
