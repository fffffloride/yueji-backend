// Generate the release contract from compiled entities, without connecting to a DB.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('reflect-metadata');
const { DataSource } = require('typeorm');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const output = path.join(root, 'dist/database-release');
  const source = path.join(root, 'database');
  const db = new DataSource({ type: 'mysql', database: 'youlai_admin',
    entities: [path.join(root, 'dist/**/*.entity.js').replaceAll('\\', '/')], synchronize: false });
  await db.buildMetadatas();
  const tables = db.entityMetadatas.filter(m => !m.isJunction).map(m => ({
    name: m.tableName,
    columns: m.columns.map(c => ({ name: c.databaseName, type: db.driver.normalizeType(c),
      length: c.length ? Number(c.length) : null, nullable: c.isNullable,
      primary: c.isPrimary, generated: !!c.asExpression })),
    indexes: m.indices.filter(i => i.synchronize !== false).map(i => ({ name: i.name,
      columns: i.columns.map(c => c.databaseName), unique: i.isUnique })),
  })).sort((a,b) => a.name.localeCompare(b.name));
  if (tables.length < 40) throw new Error('Entity discovery incomplete');
  fs.mkdirSync(output, {recursive: true});
  fs.cpSync(source, output, {recursive: true});
  const contract = {format: 1, tables};
  fs.writeFileSync(path.join(output, 'contract.json'), JSON.stringify(contract, null, 2)+'\n');
  // Baseline contract is immutable; the current contract follows each release's code.
  if (process.argv.includes('--freeze-baseline')) {
    fs.writeFileSync(path.join(source, 'baseline/contract.json'), JSON.stringify(contract, null, 2)+'\n');
    fs.copyFileSync(path.join(source, 'baseline/contract.json'), path.join(output, 'baseline/contract.json'));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json')));
  for (const entry of [manifest.baseline, ...manifest.migrations]) {
    for (const item of entry.files) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(output, item.path))).digest('hex');
      if (actual !== item.sha256) throw new Error(`Immutable migration changed: ${item.path}`);
    }
  }
  console.log(`Database release prepared: ${tables.length} entity tables`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
