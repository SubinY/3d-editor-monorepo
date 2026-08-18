import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data')

async function wipeDir(dir) {
  await fs.mkdir(dir, { recursive: true })
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.name === '.gitkeep') continue
    const p = path.join(dir, e.name)
    await fs.rm(p, { recursive: true, force: true })
  }
}

const dirs = ['documents/scenes', 'documents/containers']

for (const rel of dirs) {
  await wipeDir(path.join(root, rel))
}

const docsRoot = path.join(root, 'documents')
for (const e of await fs.readdir(docsRoot, { withFileTypes: true })) {
  if (e.isFile()) await fs.unlink(path.join(docsRoot, e.name))
}

await fs.writeFile(
  path.join(root, 'comm.json'),
  `${JSON.stringify({ version: 1, sources: [] }, null, 2)}\n`,
  'utf8'
)

console.log('data wiped:', root)
