#!/usr/bin/env bash
# Run once as root from the reviewed ops bundle, before the first gated release.
set -Eeuo pipefail
umask 077
[[ $EUID == 0 ]]
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ops=/usr/local/lib/yueji-release
exec 9>/run/lock/yueji-release.lock
flock -w 120 9
test -s "$ops/backup.py"
bash -n "$source_dir/release.sh"
bash -n "$source_dir/dispatch.sh"
python3 - "$source_dir" <<'PY'
from pathlib import Path
import sys
root = Path(sys.argv[1])
for name in ['verify-backup.py', 'database-release.py', 'readiness.py']:
    compile((root/name).read_text(), name, 'exec')
PY
backup="/opt/yueji/shared/backups/release-gate-$(date -u +%Y%m%dT%H%M%SZ)-$$"
install -d -m 700 "$backup"
for file in release.sh verify-backup.py database-release.py readiness.py; do
  if [[ -f "$ops/$file" ]]; then cp -p "$ops/$file" "$backup/$file"; fi
done
cp -p /usr/local/sbin/yueji-release "$backup/dispatch.sh"
# Install dependencies first, entry point last. The shared release lock excludes jobs.
for file in database-release.py readiness.py verify-backup.py release.sh; do
  install -o root -g root -m 644 "$source_dir/$file" "$ops/$file.next"
  mv -fT "$ops/$file.next" "$ops/$file"
done
install -o root -g root -m 755 "$source_dir/dispatch.sh" /usr/local/sbin/yueji-release.next
mv -fT /usr/local/sbin/yueji-release.next /usr/local/sbin/yueji-release
echo "DATABASE_GATE_INSTALLED protocol=1 backup=$backup"
