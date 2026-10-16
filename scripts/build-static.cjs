const { mkdirSync, rmSync, copyFileSync, cpSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const output = join(root, 'public');
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
for (const file of ['index.html', 'styles.css', 'script.js']) copyFileSync(join(root, file), join(output, file));
cpSync(join(root, 'assets'), join(output, 'assets'), { recursive: true });
