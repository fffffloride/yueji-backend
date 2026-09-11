#!/usr/bin/env python3
"""Consistent Yueji business backup. --run briefly pauses backend and MinIO."""
import datetime
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tarfile
import time
import urllib.request

ROOT = Path('/opt/yueji/shared/backups')
NODE = '/opt/node-v22.23.2/bin/node'
SERVICE = 'yueji-backend.service'
MYSQL = 'yueji-mysql-1'
MINIO = 'yueji-minio-1'
DB = 'youlai_admin'

def run(args, timeout=60, **kwargs):
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       timeout=timeout, **kwargs)
    if p.returncode:
        # Commands may handle secrets or business data; never echo their output.
        raise RuntimeError(f'{args[0]} failed, exit {p.returncode}')
    return p.stdout

def sql(query, container=MYSQL):
    return run(['docker', 'exec', '-i', container, 'sh', '-c',
                ': "${MYSQL_ROOT_PASSWORD:?}"; export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -u root -N -B'],
               input=query.encode()).decode().strip()

def db_inventory(container=MYSQL):
    tables = sql("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='youlai_admin' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;", container).splitlines()
    if not tables:
        raise RuntimeError('No business tables')
    rows = []
    for table in tables:
        quoted = '`' + table.replace('`', '``') + '`'
        count = int(sql(f'SELECT COUNT(*) FROM `{DB}`.{quoted};', container))
        checksum = sql(f'CHECKSUM TABLE `{DB}`.{quoted} EXTENDED;', container).split('\t')[-1]
        if checksum == 'NULL':
            raise RuntimeError('Unsupported table checksum')
        rows.append([table, count, checksum])
    return rows

MINIO_JS = r'''
const fs = require('node:fs');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const req = createRequire('/opt/yueji/current/yueji-backend/package.json');
const Minio = req('minio');
const client = new Minio.Client({endPoint:process.env.BACKUP_MINIO_HOST || '127.0.0.1',port:9000,useSSL:false,
 accessKey:process.env.MINIO_ROOT_USER,secretKey:process.env.MINIO_ROOT_PASSWORD});
(async()=>{
 const inventory=[];
 for (const bucket of (await client.listBuckets()).sort((a,b)=>a.name.localeCompare(b.name))) {
  const objects=[];
  for await (const object of client.listObjectsV2(bucket.name,'',true)) {
   const hash=crypto.createHash('sha256');
   const stream=await client.getObject(bucket.name,object.name);
   for await (const chunk of stream) hash.update(chunk);
   objects.push([object.name,object.size,hash.digest('hex')]);
  }
  objects.sort((a,b)=>a[0].localeCompare(b[0]));
  inventory.push([bucket.name,objects]);
 }
 process.stdout.write(JSON.stringify(inventory));
})().catch(()=>{process.stderr.write('MinIO inventory failed\n');process.exitCode=1;});
'''

def minio_inventory(info, host='127.0.0.1'):
    env = dict(os.environ)
    values = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
    for key in ['MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD']:
        if not values.get(key):
            raise RuntimeError(f'Missing {key} configuration')
        env[key] = values[key]
    env['BACKUP_MINIO_HOST'] = host
    return json.loads(run([NODE, '-e', MINIO_JS], timeout=60, env=env))

def health():
    with urllib.request.urlopen('http://127.0.0.1/', timeout=5) as r:
        if r.status != 200:
            raise RuntimeError('Frontend health failed')
    with urllib.request.urlopen('http://127.0.0.1/prod-api/api/v1/auth/captcha', timeout=5) as r:
        if r.status != 200 or json.load(r).get('code') != '00000':
            raise RuntimeError('Backend health failed')

def digest(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ['--preflight', '--run']:
        raise SystemExit('Use --preflight or --run')
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    os.umask(0o077)
    release = Path('/opt/yueji/current').resolve(strict=True)
    if release != Path('/opt/yueji/releases/20260830185734'):
        raise RuntimeError('Release changed; recheck backup scope')
    if shutil.disk_usage(ROOT).free < 1024**3:
        raise RuntimeError('Less than 1 GiB free')
    info = json.loads(run(['docker', 'inspect', MYSQL, MINIO]))
    mysql, minio = info
    if not all(item['State']['Running'] for item in info):
        raise RuntimeError('A source container is not running')
    run(['systemctl', 'is-active', '--quiet', SERVICE])
    if sql("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='youlai_admin' AND TABLE_TYPE='BASE TABLE' AND ENGINE<>'InnoDB';") != '0':
        raise RuntimeError('Non-InnoDB table requires a different dump method')
    volume = next(m['Source'] for m in minio['Mounts'] if m['Destination'] == '/data')
    if volume != '/var/lib/docker/volumes/yueji_minio-data/_data':
        raise RuntimeError('MinIO volume changed')
    config_paths = [Path('/opt/yueji/shared/runtime.env'), Path('/opt/yueji/shared/backend.env'),
                    Path('/etc/systemd/system/yueji-backend.service'), release/'compose.yml', release/'nginx.conf']
    config_paths += sorted(Path('/etc/systemd/system/yueji-backend.service.d').glob('*.conf'))
    if Path('/opt/yueji/shared/ci-admin.override.yml').exists():
        config_paths.append(Path('/opt/yueji/shared/ci-admin.override.yml'))
    for path in config_paths:
        if not path.is_file():
            raise RuntimeError('Missing recovery configuration')
    health()
    inventory = minio_inventory(minio)
    print(json.dumps({'preflight':'passed','tables':len(db_inventory()),
                      'buckets':len(inventory),'objects':sum(len(x[1]) for x in inventory)}), flush=True)
    if sys.argv[1] == '--preflight':
        return
    lock = open('/run/lock/yueji-first-backup.lock', 'w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    target = ROOT/('full-'+stamp)
    target.mkdir(mode=0o700)
    def interrupted(signum, frame):
        raise RuntimeError('Backup interrupted')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    started = time.monotonic()
    restart_errors = []
    try:
        run(['systemctl', 'stop', SERVICE], timeout=60)
        objects = minio_inventory(minio)
        run(['docker', 'stop', '--time', '30', MINIO], timeout=45)
        rows = db_inventory()
        dump = run(['docker', 'exec', MYSQL, 'sh', '-c',
                    ': "${MYSQL_ROOT_PASSWORD:?}"; export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump -u root --single-transaction --quick --routines --events --triggers --hex-blob --no-tablespaces --set-gtid-purged=OFF --databases youlai_admin'], timeout=120)
        with gzip.open(target/'database.sql.gz', 'wb', compresslevel=6) as f:
            f.write(dump)
        with tarfile.open(target/'uploads.tar.gz', 'w:gz') as archive:
            archive.add(volume, arcname='minio-data')
        with tarfile.open(target/'configuration.tar.gz', 'w:gz') as archive:
            for path in config_paths:
                archive.add(path, arcname=str(path).lstrip('/'))
        (target/'source-inventory.json').write_text(json.dumps({'database':rows,'minio':objects,
          'release':str(release),'mysql_image':mysql['Image'],'minio_image':minio['Image'],
          'backend_directory':run(['systemctl','show',SERVICE,'-p','WorkingDirectory','--value']).decode().strip(),
          'admin_directory':run(['docker','inspect','--format',
            '{{range .Mounts}}{{if eq .Destination "/usr/share/nginx/html"}}{{.Source}}{{end}}{{end}}',
            'yueji-admin-1']).decode().strip()}))
    finally:
        # Always attempt both restarts, even when a dump or the first restart fails.
        for args in [['docker','start',MINIO], ['systemctl','start',SERVICE]]:
            try:
                run(args, timeout=60)
            except Exception:
                restart_errors.append(args[-1])
        if restart_errors:
            raise RuntimeError('Service restart failed: '+','.join(restart_errors))
    for attempt in range(30):
        try:
            health()
            break
        except Exception:
            if attempt == 29:
                raise
            time.sleep(1)
    duration = round(time.monotonic()-started, 2)
    for path in target.iterdir():
        path.chmod(0o600)
    files = {p.name:{'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(target.iterdir())}
    manifest = {'created_utc':stamp,'service_pause_and_recovery_seconds':duration,'files':files,
                'tables':len(rows),'rows':sum(x[1] for x in rows),'buckets':len(objects),
                'objects':sum(len(x[1]) for x in objects),'production_health':'passed',
                'off_server_upload':'pending','restore_verification':'pending'}
    (target/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({'local_backup':str(target),**manifest}), flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'backup':'failed','error_type':type(exc).__name__,'message':str(exc)}), file=sys.stderr)
        sys.exit(1)
