#!/bin/bash
# Installed as /usr/local/sbin/yueji-release; this is the only sudo entry point.
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
if [[ $EUID == 0 && $# == 1 && "$1" == --resume && -z ${SUDO_USER:-} ]]; then
  exec 9>/run/lock/yueji-release.lock
  flock -w 900 9
  failed=0
  docker start yueji-minio-1 >/dev/null || failed=1
  systemctl start yueji-backend.service || failed=1
  exit "$failed"
fi
[[ $EUID == 0 && $# == 5 ]] || exit 2
[[ "$1" == admin || "$1" == backend ]] || exit 2
case "$2" in
  check|rollback) [[ -z "$3$4$5" ]] || exit 2 ;;
  deploy)
    [[ "$3" =~ ^[0-9]+-[0-9]+-[0-9a-f]{40}$ && "$4" =~ ^[0-9a-f]{64}$ ]] || exit 2
    [[ "$5" =~ ^/home/yueji-deploy/staging/release\.[A-Za-z0-9]+$ ]] || exit 2 ;;
  *) exit 2 ;;
esac
if [[ "$2" == check ]]; then
  exec /bin/bash /usr/local/lib/yueji-release/release.sh "$@"
fi
# The server owns the job lifetime even if the SSH connection disappears.
unit=yueji-release-$1-$(date +%s)-$$
systemd-run --quiet --wait --collect --unit="$unit" --service-type=exec \
  --property=RuntimeMaxSec=1200 --property=TimeoutStopSec=180 \
  --property='ExecStopPost=/usr/local/sbin/yueji-release --resume' \
  /bin/bash /usr/local/lib/yueji-release/release.sh "$@" && result=0 || result=$?
journalctl --no-pager -o cat -u "$unit" -n 80
exit "$result"
