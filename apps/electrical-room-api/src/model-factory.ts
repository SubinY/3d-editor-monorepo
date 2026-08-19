import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import * as esbuild from 'esbuild'
import { DATA_ROOT } from './store.js'
import {
  generateFactorySource,
  normalizeFootprint,
  repairFactorySource,
  type ModelInventory
} from './ark.js'

const DRAFTS_DIR = path.join(DATA_ROOT, 'model-factory-drafts')
const MODELS_DIR = path.join(DATA_ROOT, 'models')
const BUILD_TMP = path.join(DATA_ROOT, 'model-factory-tmp')

export interface ModelFactoryDraft {
  id: string
  name: string
  sourceCode: string
  footprintHint: { width: number; depth: number; height: number }
  inventory?: ModelInventory
  mimeType?: string
  createdAt: number
  updatedAt: number
}

async function ensureFactoryDirs(): Promise<void> {
  await fs.mkdir(DRAFTS_DIR, { recursive: true })
  await fs.mkdir(MODELS_DIR, { recursive: true })
  await fs.mkdir(BUILD_TMP, { recursive: true })
}

function draftPath(id: string): string {
  return path.join(DRAFTS_DIR, `${id}.json`)
}

export async function initModelFactoryStore(): Promise<void> {
  await ensureFactoryDirs()
}

export async function saveDraft(draft: ModelFactoryDraft): Promise<ModelFactoryDraft> {
  await ensureFactoryDirs()
  await fs.writeFile(draftPath(draft.id), JSON.stringify(draft, null, 2), 'utf8')
  return draft
}

export async function getDraft(id: string): Promise<ModelFactoryDraft | undefined> {
  try {
    const raw = await fs.readFile(draftPath(id), 'utf8')
    return JSON.parse(raw) as ModelFactoryDraft
  } catch {
    return undefined
  }
}

export async function createDraftFromImage(input: {
  imageBase64: string
  mimeType: string
  name?: string
  footprint: { width: number; depth: number; height: number }
}): Promise<ModelFactoryDraft> {
  const footprint = normalizeFootprint(input.footprint)
  const { sourceCode, inventory } = await generateFactorySource({
    ...input,
    footprint
  })
  let code = sourceCode
  try {
    await compileSourceToEsm(code, path.join(BUILD_TMP, `_check-${Date.now()}.mjs`))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    code = await repairFactorySource({ sourceCode: code, compileError: message })
    await compileSourceToEsm(code, path.join(BUILD_TMP, `_check-repair-${Date.now()}.mjs`))
  }

  const now = Date.now()
  const draft: ModelFactoryDraft = {
    id: `draft-${randomUUID().slice(0, 8)}`,
    name: input.name?.trim() || inventory.objectClass || 'AI Component',
    sourceCode: code,
    footprintHint: { ...footprint },
    inventory,
    mimeType: input.mimeType,
    createdAt: now,
    updatedAt: now
  }
  return saveDraft(draft)
}

export async function updateDraftSource(
  id: string,
  patch: { sourceCode?: string; name?: string; footprintHint?: ModelFactoryDraft['footprintHint'] }
): Promise<ModelFactoryDraft> {
  const draft = await getDraft(id)
  if (!draft) {
    const err = new Error('draft not found') as Error & { status?: number }
    err.status = 404
    throw err
  }
  if (patch.sourceCode !== undefined) draft.sourceCode = patch.sourceCode
  if (patch.name !== undefined) draft.name = patch.name
  if (patch.footprintHint !== undefined) draft.footprintHint = patch.footprintHint
  draft.updatedAt = Date.now()
  return saveDraft(draft)
}

async function compileSourceToEsm(sourceCode: string, outfile: string): Promise<void> {
  await ensureFactoryDirs()
  const infile = path.join(BUILD_TMP, `${path.basename(outfile, '.mjs')}-${Date.now()}.ts`)
  await fs.writeFile(infile, sourceCode, 'utf8')
  try {
    await esbuild.build({
      entryPoints: [infile],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      external: ['three'],
      logLevel: 'silent'
    })
  } finally {
    await fs.unlink(infile).catch(() => undefined)
  }
}

export async function previewBuild(draftId: string): Promise<{ url: string }> {
  const draft = await getDraft(draftId)
  if (!draft) {
    const err = new Error('draft not found') as Error & { status?: number }
    err.status = 404
    throw err
  }
  const previewDir = path.join(MODELS_DIR, '_preview')
  await fs.mkdir(previewDir, { recursive: true })
  const file = `${draftId}.mjs`
  const outfile = path.join(previewDir, file)
  await compileSourceToEsm(draft.sourceCode, outfile)
  return { url: `/models/_preview/${file}` }
}

export async function publishDraft(input: {
  draftId: string
  id: string
  version: string
}): Promise<{
  url: string
  catalogItem: Record<string, unknown>
}> {
  const draft = await getDraft(input.draftId)
  if (!draft) {
    const err = new Error('draft not found') as Error & { status?: number }
    err.status = 404
    throw err
  }
  const id = input.id.trim()
  const version = input.version.trim() || '1.0.0'
  if (!id) {
    const err = new Error('id required') as Error & { status?: number }
    err.status = 400
    throw err
  }

  const file = `${id}@${version}.mjs`
  const outfile = path.join(MODELS_DIR, file)
  await compileSourceToEsm(draft.sourceCode, outfile)
  const url = `/models/${file}`
  const fp = draft.footprintHint
  /** 仅编译落盘；不写默认 Catalog。Host 再 POST /api/asset-drafts。 */
  const catalogItem = {
    id,
    version,
    name: draft.name,
    kind: 'component',
    category: 'component',
    placeableIn: ['container'] as string[],
    footprint: { ...fp },
    thumb: '#5dade2',
    model3d: { type: 'procedural' as const, id, url }
  }
  return { url, catalogItem }
}

export function modelsDir(): string {
  return MODELS_DIR
}
