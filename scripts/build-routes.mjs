import { mkdir, copyFile } from 'node:fs/promises';
for (const route of ['explore', 'blog', 'proof']) {
  await mkdir(new URL(`../dist/${route}/`, import.meta.url), { recursive: true });
  await copyFile(new URL('../dist/index.html', import.meta.url), new URL(`../dist/${route}/index.html`, import.meta.url));
}
await mkdir(new URL('../dist/content/', import.meta.url), { recursive: true });
await copyFile(new URL('../content/blue-room.md', import.meta.url), new URL('../dist/content/blue-room.md', import.meta.url));
