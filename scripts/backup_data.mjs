import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const backupDir = path.join(root, 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupDir, `data-backup-${stamp}`);
fs.mkdirSync(target, { recursive: true });

for (const file of fs.readdirSync(dataDir)) {
  const src = path.join(dataDir, file);
  const dest = path.join(target, file);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, dest);
  }
}

console.log(`Backup created at ${target}`);
