<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MockAsset, MockNode } from '../mock-data'
import { ROOM, statusColor } from '../mock-data'

const props = defineProps<{
  nodes: MockNode[]
  selectedId: string | null
  assets: MockAsset[]
  placePreview: { asset: MockAsset; x: number; z: number } | null
}>()

const emit = defineEmits<{
  select: [id: string | null]
  'open-interior': []
  place: [asset: MockAsset, x: number, z: number]
  'preview-place': [asset: MockAsset, x: number, z: number]
}>()

const host = ref<HTMLElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let raf = 0
const meshMap = new Map<string, THREE.Mesh>()
let ghostMesh: THREE.Mesh | null = null
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose()
  const mat = mesh.material
  if (Array.isArray(mat)) mat.forEach(m => m.dispose())
  else mat.dispose()
}

function rebuildNodes() {
  if (!scene) return
  for (const [id, mesh] of meshMap) {
    scene.remove(mesh)
    disposeMesh(mesh)
    meshMap.delete(id)
  }
  for (const n of props.nodes) {
    const geo = new THREE.BoxGeometry(n.w, n.h, n.d)
    const mat = new THREE.MeshStandardMaterial({
      color: n.color,
      emissive: n.id === props.selectedId ? new THREE.Color('#0a3a55') : new THREE.Color('#000'),
      emissiveIntensity: n.id === props.selectedId ? 0.55 : 0,
      metalness: 0.35,
      roughness: 0.55
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(n.x - ROOM.width / 2, n.h / 2, n.z - ROOM.depth / 2)
    mesh.rotation.y = (n.yawDeg * Math.PI) / 180
    mesh.userData.nodeId = n.id
    mesh.castShadow = true
    mesh.receiveShadow = true
    // status dot
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 12),
      new THREE.MeshBasicMaterial({ color: statusColor(n.status) })
    )
    dot.position.set(n.w / 2 - 0.08, n.h / 2 - 0.08, n.d / 2 + 0.01)
    mesh.add(dot)
    scene.add(mesh)
    meshMap.set(n.id, mesh)
  }
}

function updateGhost() {
  if (!scene) return
  if (ghostMesh) {
    scene.remove(ghostMesh)
    disposeMesh(ghostMesh)
    ghostMesh = null
  }
  const p = props.placePreview
  if (!p) return
  const geo = new THREE.BoxGeometry(p.asset.w, p.asset.h, p.asset.d)
  const mat = new THREE.MeshStandardMaterial({
    color: '#3dd6ff',
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  })
  ghostMesh = new THREE.Mesh(geo, mat)
  ghostMesh.position.set(p.x - ROOM.width / 2, p.asset.h / 2, p.z - ROOM.depth / 2)
  scene.add(ghostMesh)
}

function worldFromEvent(e: DragEvent | MouseEvent) {
  if (!host.value || !camera || !renderer) return null
  const rect = host.value.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, hit)
  if (!hit) return null
  return {
    x: Math.min(ROOM.width - 0.2, Math.max(0.2, hit.x + ROOM.width / 2)),
    z: Math.min(ROOM.depth - 0.2, Math.max(0.2, hit.z + ROOM.depth / 2))
  }
}

function onPointerDown(e: MouseEvent) {
  if (!camera || !renderer || !host.value) return
  const rect = host.value.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects([...meshMap.values()], false)
  if (hits[0]) {
    const id = hits[0].object.userData.nodeId as string
    emit('select', id)
    if (e.detail === 2) emit('open-interior')
  } else {
    emit('select', null)
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  const world = worldFromEvent(e)
  if (world && props.placePreview) {
    emit('preview-place', props.placePreview.asset, world.x, world.z)
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const id = e.dataTransfer?.getData('application/ux-demo-asset')
  const asset = props.assets.find(a => a.id === id)
  const world = worldFromEvent(e)
  if (asset && world) emit('place', asset, world.x, world.z)
}

function resize() {
  if (!host.value || !renderer || !camera) return
  const w = host.value.clientWidth
  const h = host.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}

function tick() {
  controls?.update()
  if (renderer && scene && camera) renderer.render(scene, camera)
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  if (!host.value) return
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0a1018')
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(8, 9, 11)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.shadowMap.enabled = true
  host.value.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.8, 0)
  controls.enableDamping = false

  const amb = new THREE.AmbientLight(0x9eb6d0, 0.55)
  const dir = new THREE.DirectionalLight(0xffffff, 1.05)
  dir.position.set(6, 12, 4)
  dir.castShadow = true
  scene.add(amb, dir)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({ color: '#2a3544', roughness: 0.9 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const grid = new THREE.GridHelper(Math.max(ROOM.width, ROOM.depth), 12, 0x3d4d60, 0x243142)
  scene.add(grid)

  const wallMat = new THREE.MeshStandardMaterial({ color: '#3a4858', roughness: 0.85 })
  const back = new THREE.Mesh(new THREE.BoxGeometry(ROOM.width, 3, 0.12), wallMat)
  back.position.set(0, 1.5, -ROOM.depth / 2)
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3, ROOM.depth), wallMat)
  left.position.set(-ROOM.width / 2, 1.5, 0)
  scene.add(back, left)

  rebuildNodes()
  resize()
  window.addEventListener('resize', resize)
  host.value.addEventListener('pointerdown', onPointerDown)
  tick()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  host.value?.removeEventListener('pointerdown', onPointerDown)
  controls?.dispose()
  renderer?.dispose()
  meshMap.forEach(disposeMesh)
  meshMap.clear()
  if (ghostMesh) disposeMesh(ghostMesh)
  renderer?.domElement.remove()
})

watch(
  () => [props.nodes, props.selectedId] as const,
  () => rebuildNodes(),
  { deep: true }
)
watch(
  () => props.placePreview,
  () => updateGhost(),
  { deep: true }
)
</script>

<template>
  <div
    ref="host"
    class="three-host"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <div class="tag">三维视口 · Three.js（不接内核）</div>
  </div>
</template>

<style scoped>
.three-host {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
.three-host :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.tag {
  position: absolute;
  top: 10px;
  left: 12px;
  font-size: 11px;
  color: #7b90a8;
  background: rgba(0, 0, 0, 0.35);
  padding: 3px 8px;
  border-radius: 6px;
  pointer-events: none;
  z-index: 2;
}
</style>
