/**
 * GLB 入库优化：减面 + 压贴图 + 按 footprint 烘焙尺寸。
 * 不输出 Draco（内核 GLTFLoader 未挂解码器）。
 */
import { Document, NodeIO, Primitive } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  dedup,
  flatten,
  getBounds,
  prune,
  simplify,
  textureCompress,
  weld
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

export const TARGET_TRIANGLES = 30_000
export const TEXTURE_MAX = 1024
export const HEAVY_TRIANGLES = 100_000

export interface FootprintMeters {
  width: number
  depth: number
  height: number
}

export interface OptimizeGlbResult {
  data: Buffer
  bbox: FootprintMeters
  trianglesBefore: number
  trianglesAfter: number
  textureMax: number
  warning?: string
}

function createIO(): NodeIO {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS)
}

function round3(n: number): number {
  return Math.max(0.01, Math.round(n * 1000) / 1000)
}

function bboxToFootprint(min: number[], max: number[]): FootprintMeters {
  return {
    width: round3(max[0]! - min[0]!),
    depth: round3(max[2]! - min[2]!),
    height: round3(max[1]! - min[1]!)
  }
}

function primitiveTriangles(prim: Primitive): number {
  const indices = prim.getIndices()
  const pos = prim.getAttribute('POSITION')
  const count = indices ? indices.getCount() : (pos?.getCount() ?? 0)
  const mode = prim.getMode()
  if (mode === Primitive.Mode.TRIANGLES) return Math.floor(count / 3)
  if (mode === Primitive.Mode.TRIANGLE_STRIP || mode === Primitive.Mode.TRIANGLE_FAN) {
    return Math.max(0, count - 2)
  }
  return 0
}

function countTriangles(document: Document): number {
  let n = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      n += primitiveTriangles(prim)
    }
  }
  return Math.round(n)
}

function maxTextureSize(document: Document): number {
  let max = 0
  for (const tex of document.getRoot().listTextures()) {
    const size = tex.getSize()
    if (size) max = Math.max(max, size[0], size[1])
  }
  return max
}

function sceneOf(document: Document) {
  const root = document.getRoot()
  return root.getDefaultScene() ?? root.listScenes()[0] ?? null
}

function measureBbox(document: Document): FootprintMeters {
  const scene = sceneOf(document)
  if (!scene) return { width: 0.1, depth: 0.1, height: 0.1 }
  const bounds = getBounds(scene)
  return bboxToFootprint(bounds.min, bounds.max)
}

function fitDocumentToFootprint(document: Document, footprint: FootprintMeters): void {
  const scene = sceneOf(document)
  if (!scene) return
  const bounds = getBounds(scene)
  const sizeX = Math.max(bounds.max[0]! - bounds.min[0]!, 1e-6)
  const sizeY = Math.max(bounds.max[1]! - bounds.min[1]!, 1e-6)
  const sizeZ = Math.max(bounds.max[2]! - bounds.min[2]!, 1e-6)
  const sx = footprint.width / sizeX
  const sy = (footprint.height > 0 ? footprint.height : sizeY) / sizeY
  const sz = footprint.depth / sizeZ
  const cx = (bounds.min[0]! + bounds.max[0]!) / 2
  const cz = (bounds.min[2]! + bounds.max[2]!) / 2
  const minY = bounds.min[1]!
  const wrapper = document.createNode('__fit__')
  wrapper.setScale([sx, sy, sz])
  wrapper.setTranslation([-sx * cx, -sy * minY, -sz * cz])
  for (const child of scene.listChildren()) {
    wrapper.addChild(child)
  }
  scene.addChild(wrapper)
}

async function writeGlb(document: Document): Promise<Buffer> {
  const bytes = await createIO().writeBinary(document)
  return Buffer.from(bytes)
}

export async function optimizeGlbBuffer(data: Buffer, filename: string): Promise<OptimizeGlbResult> {
  const io = createIO()
  const lower = filename.toLowerCase()
  let document: Document
  if (lower.endsWith('.glb')) {
    document = await io.readBinary(new Uint8Array(data))
  } else {
    document = await io.readJSON({
      json: JSON.parse(data.toString('utf8')),
      resources: {}
    })
  }

  const trianglesBefore = countTriangles(document)
  const ready = MeshoptSimplifier.ready
  if (ready) await ready

  try {
    await document.transform(dedup(), weld())
  } catch (err) {
    console.warn('[gltf-optimize] weld/dedup skipped:', err instanceof Error ? err.message : err)
  }

  const ratio =
    trianglesBefore > 0 ? Math.min(1, TARGET_TRIANGLES / trianglesBefore) : 1
  if (ratio < 0.999) {
    try {
      await document.transform(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio,
          error: 1
        })
      )
    } catch (err) {
      console.warn('[gltf-optimize] simplify skipped:', err instanceof Error ? err.message : err)
    }
  }

  try {
    await document.transform(
      textureCompress({
        encoder: sharp,
        resize: [TEXTURE_MAX, TEXTURE_MAX]
      }),
      prune()
    )
  } catch (err) {
    console.warn('[gltf-optimize] textureCompress skipped:', err instanceof Error ? err.message : err)
  }

  const trianglesAfter = countTriangles(document)
  const textureMax = maxTextureSize(document)
  const bbox = measureBbox(document)
  const out = await writeGlb(document)
  const warning =
    trianglesAfter > HEAVY_TRIANGLES
      ? '仍偏重，柜内多件可能卡'
      : undefined

  return {
    data: out,
    bbox,
    trianglesBefore,
    trianglesAfter,
    textureMax,
    warning
  }
}

export async function fitGlbBuffer(
  data: Buffer,
  footprint: FootprintMeters
): Promise<{ data: Buffer; bbox: FootprintMeters }> {
  const document = await createIO().readBinary(new Uint8Array(data))
  fitDocumentToFootprint(document, footprint)
  try {
    await document.transform(flatten(), prune())
  } catch (err) {
    console.warn('[gltf-optimize] flatten skipped:', err instanceof Error ? err.message : err)
  }
  return {
    data: await writeGlb(document),
    bbox: measureBbox(document)
  }
}

export function isGlbFilename(filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower.endsWith('.glb') || lower.endsWith('.gltf')
}
