import './build-modules.mjs';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Copy file contents without replacing existing directory metadata on Windows.
function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      const content = readFileSync(from);
      if (!existsSync(to) || !content.equals(readFileSync(to))) {
        writeFileSync(to, content);
      }
    } else {
      throw new Error(`Unsupported source entry: ${from}`);
    }
  }
}

copyDirectory(
  fileURLToPath(new URL('./src/', import.meta.url)),
  fileURLToPath(new URL('./dist/', import.meta.url)),
);
console.log('Built src → dist');
