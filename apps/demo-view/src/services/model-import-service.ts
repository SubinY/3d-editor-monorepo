import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export interface ImportProfile {
  sourceFormat: 'glb' | 'gltf'
  normalizedToGlb: boolean
  cleanups: string[]
  aggressiveOptimization: boolean
}

export interface ImportModelStats {
  nodeCount: number
  meshCount: number
  triangleCount: number
  size: [number, number, number]
}

export interface PreparedModel {
  blob: Blob
  fileName: string
  stats: ImportModelStats
  profile: ImportProfile
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.?\//, '').trim()
}

function collectStats(root: THREE.Object3D): ImportModelStats {
  let nodeCount = 0
  let meshCount = 0
  let triangleCount = 0

  root.updateMatrixWorld(true)
  root.traverse(obj => {
    nodeCount += 1
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return

    meshCount += 1
    const geometry = mesh.geometry as THREE.BufferGeometry
    if (!geometry) return

    if (geometry.index) triangleCount += Math.floor(geometry.index.count / 3)
    else {
      const pos = geometry.getAttribute('position')
      if (pos) triangleCount += Math.floor(pos.count / 3)
    }
  })

  const box = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3()
  if (!box.isEmpty()) box.getSize(size)

  return {
    nodeCount,
    meshCount,
    triangleCount,
    size: [size.x, size.y, size.z]
  }
}

function pruneEmptyNodes(root: THREE.Object3D): void {
  const toRemove: THREE.Object3D[] = []
  root.traverse(obj => {
    if (obj === root) return
    if (obj.children.length === 0 && !(obj as THREE.Mesh).isMesh) {
      toRemove.push(obj)
    }
  })
  toRemove.forEach(node => node.parent?.remove(node))
}

async function loadGlbBlob(blob: Blob): Promise<GLTF> {
  const url = URL.createObjectURL(blob)
  try {
    const loader = new GLTFLoader()
    return await loader.loadAsync(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function parseGltfBundle(files: File[]): Promise<GLTF> {
  const gltfFile = files.find(file => file.name.toLowerCase().endsWith('.gltf'))
  if (!gltfFile) throw new Error('未找到 .gltf 文件')

  const objectUrlMap = new Map<string, string>()
  const register = (key: string, file: File) => {
    const normalized = normalizePath(key)
    if (!normalized || objectUrlMap.has(normalized)) return
    objectUrlMap.set(normalized, URL.createObjectURL(file))
  }

  files.forEach(file => {
    const relativePath = normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
    register(relativePath, file)
    register(file.name, file)

    const segments = relativePath.split('/')
    if (segments.length > 1) {
      register(segments.slice(1).join('/'), file)
      register(segments[segments.length - 1], file)
    }
  })

  const manager = new THREE.LoadingManager()
  manager.setURLModifier(url => {
    const normalized = normalizePath(decodeURIComponent(url))
    return objectUrlMap.get(normalized) || objectUrlMap.get(normalized.split('/').pop() || '') || url
  })

  const loader = new GLTFLoader(manager)
  const source = await gltfFile.text()

  try {
    return await new Promise<GLTF>((resolve, reject) => {
      loader.parse(source, '', resolve, err => reject(err ?? new Error('GLTF 解析失败')))
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'GLTF 解析失败'
    throw new Error(`gltf 资源包解析失败：${msg}`)
  } finally {
    objectUrlMap.forEach(url => URL.revokeObjectURL(url))
  }
}

async function exportGlb(scene: THREE.Object3D, animations: THREE.AnimationClip[] = []): Promise<Blob> {
  const exporter = new GLTFExporter()
  const binary = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      result => {
        if (result instanceof ArrayBuffer) resolve(result)
        else reject(new Error('GLTF 导出未返回二进制 GLB'))
      },
      error => reject(error ?? new Error('GLTF 导出失败')),
      {
        binary: true,
        includeCustomExtensions: true,
        animations
      }
    )
  })

  return new Blob([binary], { type: 'model/gltf-binary' })
}

export async function prepareModelFromFiles(input: File[] | FileList): Promise<PreparedModel> {
  const files = Array.isArray(input) ? input : Array.from(input)
  if (files.length === 0) throw new Error('未选择导入文件')

  const glbFile = files.find(file => file.name.toLowerCase().endsWith('.glb'))
  const hasGltf = files.some(file => file.name.toLowerCase().endsWith('.gltf'))

  if (!glbFile && !hasGltf) {
    throw new Error('仅支持 .glb 或 .gltf 资源包导入')
  }

  let gltf: GLTF
  let outputBlob: Blob
  let sourceFormat: 'glb' | 'gltf'
  let fileName: string

  if (glbFile) {
    sourceFormat = 'glb'
    fileName = glbFile.name
    gltf = await loadGlbBlob(glbFile)
    outputBlob = glbFile
  } else {
    sourceFormat = 'gltf'
    const mainName = files.find(file => file.name.toLowerCase().endsWith('.gltf'))!.name
    fileName = mainName.replace(/\.gltf$/i, '.glb')
    gltf = await parseGltfBundle(files)
    outputBlob = await exportGlb(gltf.scene, gltf.animations)
  }

  pruneEmptyNodes(gltf.scene)
  const stats = collectStats(gltf.scene)

  const profile: ImportProfile = {
    sourceFormat,
    normalizedToGlb: sourceFormat === 'gltf',
    cleanups: ['remove-empty-nodes'],
    aggressiveOptimization: false
  }

  return {
    blob: outputBlob,
    fileName,
    stats,
    profile
  }
}
