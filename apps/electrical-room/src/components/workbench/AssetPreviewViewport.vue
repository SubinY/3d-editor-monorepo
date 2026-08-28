<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiateProceduralModule } from '@mh/3d-editor'
import type { CatalogItem, FootprintSpec } from '@mh/3d-editor'

export type PreviewSpec =
  | { type: 'gltf'; url: string }
  | { type: 'procedural'; url: string; footprint: FootprintSpec; item?: CatalogItem }
  | null

const props = defineProps<{
  spec: PreviewSpec
  displayFootprint?: FootprintSpec
}>()

const emit = defineEmits<{
  loaded: [footprint: FootprintSpec]
}>()

const canvasHost = ref<HTMLElement>()
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let root: THREE.Object3D | undefined
let nativeSize: FootprintSpec | undefined
let frameId = 0
let loadToken = 0

function disposeObject(obj: THREE.Object3D) {
  obj.traverse(child => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = mesh.material
    if (!mat) return
    const mats = Array.isArray(mat) ? mat : [mat]
    for (const m of mats) {
      m.dispose()
    }
  })
}

function clearRoot() {
  if (!scene || !root) return
  scene.remove(root)
  disposeObject(root)
  root = undefined
  nativeSize = undefined
}

function frameObject(obj: THREE.Object3D) {
  if (!camera || !controls) return
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 0.01)
  const dist = maxDim * 2.2
  camera.near = Math.max(0.01, dist / 100)
  camera.far = Math.max(100, dist * 20)
  camera.updateProjectionMatrix()
  camera.position.set(center.x + dist * 0.7, center.y + dist * 0.55, center.z + dist * 0.9)
  controls.target.copy(center)
  controls.update()
}

function measureFootprint(obj: THREE.Object3D): FootprintSpec {
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  return {
    width: Math.max(0.01, Math.round(size.x * 1000) / 1000),
    depth: Math.max(0.01, Math.round(size.z * 1000) / 1000),
    height: Math.max(0.01, Math.round(size.y * 1000) / 1000)
  }
}

function applyDisplayScale() {
  if (!root || !nativeSize) return
  const target = props.displayFootprint
  if (!target) {
    root.scale.set(1, 1, 1)
    return
  }
  const sx = target.width / Math.max(nativeSize.width, 0.01)
  const sy = (target.height ?? nativeSize.height ?? 0.01) / Math.max(nativeSize.height ?? 0.01, 0.01)
  const sz = target.depth / Math.max(nativeSize.depth, 0.01)
  root.scale.set(sx, sy, sz)
}

async function loadSpec(spec: PreviewSpec) {
  if (!scene || !spec) {
    clearRoot()
    return
  }
  const token = ++loadToken
  clearRoot()
  let obj: THREE.Object3D
  if (spec.type === 'gltf') {
    const gltf = await new GLTFLoader().loadAsync(spec.url)
    obj = gltf.scene
  } else {
    obj = await instantiateProceduralModule(spec.url, THREE, {
      footprint: spec.footprint,
      item: spec.item
    })
  }
  if (token !== loadToken || !scene) {
    disposeObject(obj)
    return
  }
  root = obj
  obj.scale.set(1, 1, 1)
  scene.add(obj)
  nativeSize = measureFootprint(obj)
  applyDisplayScale()
  frameObject(obj)
  emit('loaded', nativeSize)
}

function tick() {
  frameId = requestAnimationFrame(tick)
  controls?.update()
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function onResize() {
  if (!canvasHost.value || !renderer || !camera) return
  const w = canvasHost.value.clientWidth
  const h = canvasHost.value.clientHeight
  if (w <= 0 || h <= 0) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

watch(
  () => props.spec,
  spec => {
    void loadSpec(spec)
  }
)

watch(
  () => props.displayFootprint,
  () => {
    applyDisplayScale()
    if (root) frameObject(root)
  },
  { deep: true }
)

watch(
  canvasHost,
  el => {
    if (!el || renderer) return
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0e1621)
    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    const hemi = new THREE.HemisphereLight(0xcfe0f0, 0x1a2433, 0.85)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(2, 4, 3)
    scene.add(dir)
    const grid = new THREE.GridHelper(2, 10, 0x2c3e52, 0x1d2c3e)
    grid.position.y = 0
    scene.add(grid)

    onResize()
    window.addEventListener('resize', onResize)
    tick()
    void loadSpec(props.spec)
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  window.removeEventListener('resize', onResize)
  clearRoot()
  controls?.dispose()
  renderer?.dispose()
  if (renderer?.domElement.parentElement) {
    renderer.domElement.parentElement.removeChild(renderer.domElement)
  }
  renderer = undefined
  scene = undefined
  camera = undefined
  controls = undefined
})

function captureThumb(size = 128): string | null {
  if (!renderer || !scene || !camera || !root) return null
  renderer.render(scene, camera)
  const src = renderer.domElement
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  if (!ctx) return null
  const sw = src.width
  const sh = src.height
  if (sw <= 0 || sh <= 0) return null
  const side = Math.min(sw, sh)
  const sx = (sw - side) / 2
  const sy = (sh - side) / 2
  ctx.fillStyle = '#0e1621'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(src, sx, sy, side, side, 0, 0, size, size)
  return out.toDataURL('image/jpeg', 0.85)
}

function resetViewpoint() {
  if (root) frameObject(root)
}

defineExpose({
  measureCurrent: () => (root ? measureFootprint(root) : null),
  captureThumb,
  resetViewpoint
})
</script>

<template>
  <div ref="canvasHost" class="preview-host" />
</template>

<style scoped>
.preview-host {
  width: 100%;
  height: 100%;
  min-height: 280px;
  background: #0e1621;
  border-radius: 8px;
  overflow: hidden;
}

.preview-host :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>
