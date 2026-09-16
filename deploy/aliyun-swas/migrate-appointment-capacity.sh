#!/usr/bin/env bash
# Upload alongside sql/mysql/appointment_capacity.sql, then run as root.
set -Eeuo pipefail
umask 077
[[ $EUID == 0 ]] || exit 1
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test -s "$script_dir/appointment_capacity.sql"
production=yueji-mysql-1
backup="/opt/yueji/shared/backups/appointment-capacity-$(date -u +%Y%m%dT%H%M%SZ)-$$"
exec 9>/run/lock/yueji-release.lock
flock -w 120 9
install -d -m 700 "$backup"
sql() {
  docker exec -i "$production" sh -c \
    ': "${MYSQL_ROOT_PASSWORD:?}"; export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --batch --skip-column-names --default-character-set=utf8mb4 youlai_admin'
}
# Back up before any schema or permission changes; do not print credentials.
docker exec "$production" sh -c \
  ': "${MYSQL_ROOT_PASSWORD:?}"; export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump -uroot --single-transaction --quick --routines --events --triggers --hex-blob --no-tablespaces --set-gtid-purged=OFF --databases youlai_admin' \
  | gzip > "$backup/database-before.sql.gz"
gzip -t "$backup/database-before.sql.gz"
sha256sum "$backup/database-before.sql.gz" > "$backup/database-before.sql.gz.sha256"
cp "$script_dir/appointment_capacity.sql" "$backup/"
printf 'SELECT COUNT(*) FROM appointment;\n' | sql > "$backup/appointments-before.txt"
# The additive migration preserves existing configuration and appointment data.
for attempt in 1 2; do
  { printf 'SET SESSION lock_wait_timeout=30; SET SESSION innodb_lock_wait_timeout=30;\n'; cat "$script_dir/appointment_capacity.sql"; } | sql
done
valid=$(sql <<'SQL'
SELECT IF(
  (SELECT COUNT(*) FROM appointment_config WHERE id=1 AND slot_capacity>=1 AND is_deleted=0)=1
  AND (SELECT COUNT(*) FROM sys_menu WHERE id=3403 AND perm='biz:appointment:config')=1
  AND NOT EXISTS (SELECT 1 FROM sys_role r WHERE r.id IN (1,2)
    AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm WHERE rm.role_id=r.id AND rm.menu_id=3403)),
  'OK','FAILED');
SQL
)
[[ $valid == OK ]]
printf 'SELECT COUNT(*) FROM appointment;\n' | sql > "$backup/appointments-after.txt"
# A live booking may change the count; retain both counts for inspection.
if ! cmp -s "$backup/appointments-before.txt" "$backup/appointments-after.txt"; then
  echo "Appointment count changed during migration; inspect $backup" >&2
  exit 1
fi
printf 'SELECT id,slot_capacity FROM appointment_config WHERE id=1;\n' | sql
echo "APPOINTMENT_CAPACITY_MIGRATION_OK backup=$backup"
