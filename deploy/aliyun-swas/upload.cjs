#!/usr/bin/env node
// Upload an already verified backup; never restart production services.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const req = createRequire('/opt/yueji/current/yueji-backend/package.json');
const OSS = req('ali-oss');
const bucket = 'yueji-backup-sh-e99bdc29';

async function sha256(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  assert.equal(process.getuid(), 0, 'Root required');
  process.umask(0o077);
  const directory = process.argv[2];
  assert.match(directory || '', /^\/opt\/yueji\/shared\/backups\/full-\d{8}T\d{6}Z$/);
  assert.equal(await fsp.realpath(directory), directory, 'Unexpected backup location');
  const credentialFile = '/root/yueji-backup-ops-20260910/oss.json';
  const credentialStat = await fsp.lstat(credentialFile);
  assert(credentialStat.isFile() && credentialStat.uid === 0 && (credentialStat.mode & 0o077) === 0,
    'Credentials must be root-owned and private');
  const credentials = JSON.parse(await fsp.readFile(credentialFile, 'utf8'));
  assert.equal(typeof credentials.accessKeyId, 'string');
  assert.equal(typeof credentials.accessKeySecret, 'string');
  const client = new OSS({
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    bucket, region: 'oss-cn-shanghai', authorizationV4: true,
    endpoint: 'https://oss-cn-shanghai-internal.aliyuncs.com', timeout: 60000,
  });
  const prefix = 'yueji/' + path.basename(directory) + '/';
  const manifest = JSON.parse(await fsp.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const restored = JSON.parse(await fsp.readFile(path.join(directory, 'restore-verification.json'), 'utf8'));
  assert.equal(manifest.restore_verification, 'passed');
  assert.equal(restored.restore, 'passed');
  const archives = ['configuration.tar.gz', 'database.sql.gz', 'source-inventory.json', 'uploads.tar.gz'];
  assert.deepEqual(Object.keys(manifest.files).sort(), archives);
  for (const name of archives) {
    assert.equal(await sha256(path.join(directory, name)), manifest.files[name].sha256,
      'Backup changed after restore verification');
  }
  const downloaded = await fsp.mkdtemp('/root/yueji-backup-ops-20260910/oss-check-');
  const verified = {};
  async function uploadAndCheck(name) {
    const file = path.join(directory, name);
    const stat = await fsp.lstat(file);
    assert(stat.isFile() && stat.uid === 0 && (stat.mode & 0o077) === 0, 'Backup file must be private');
    try {
      await client.put(prefix + name, file, { headers: {
        'x-oss-forbid-overwrite': 'true', 'x-oss-server-side-encryption': 'AES256',
      } });
    } catch (error) {
      // A retry may find an existing object. Accept it only after byte verification.
      if (error.status !== 409) throw error;
    }
    const copy = path.join(downloaded, name);
    const response = await client.get(prefix + name, copy);
    const hash = await sha256(file);
    assert.equal(await sha256(copy), hash, 'Downloaded backup checksum mismatch');
    assert.equal(response.res.headers['x-oss-server-side-encryption'], 'AES256', 'Encryption not confirmed');
    verified[name] = { bytes: stat.size, sha256: hash, encryption: 'AES256' };
  }
  try {
    for (const name of [...archives, 'manifest.json', 'restore-verification.json']) await uploadAndCheck(name);
    const receipt = {
      bucket, prefix, completedUtc: new Date().toISOString(), files: { ...verified },
      downloadVerification: 'passed', restoreVerification: 'passed',
      tables: restored.tables, rows: restored.rows, buckets: restored.buckets, objects: restored.objects,
    };
    const receiptPath = path.join(directory, 'upload-receipt.json');
    // Preserve the original receipt on retry so remote immutable content stays identical.
    try { await fsp.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await uploadAndCheck('upload-receipt.json');
    console.log(JSON.stringify({ upload: 'passed', bucket, prefix, files: Object.keys(verified).length,
      bytes: Object.values(verified).reduce((sum, item) => sum + item.bytes, 0),
      downloadVerification: 'passed', restoreVerification: 'passed', encryption: 'AES256' }));
  } finally {
    await fsp.rm(downloaded, { recursive: true, force: true });
  }
}

main().catch(error => {
  // SDK errors may contain signed request URLs; report only their safe status/code.
  console.error(JSON.stringify({ upload: 'failed', type: error.name, code: error.code, status: error.status }));
  process.exitCode = 1;
});
