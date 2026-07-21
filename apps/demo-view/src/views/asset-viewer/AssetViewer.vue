<template>
  <div class="viewer-page">
    <header class="viewer-header">
      <div class="header-left">
        <router-link to="/asset-library" class="back-btn" title="返回资产库">
          <Icon icon="mdi:arrow-left" />
        </router-link>
        <div class="app-brand">
          <Icon icon="mdi:eye-outline" class="brand-icon" />
          <span class="brand-text">资产查看</span>
        </div>
        <span v-if="assetName" class="name-badge">
          <Icon icon="mdi:tag-outline" />
          {{ assetName }}
        </span>
      </div>
      <div class="header-right">
        <router-link
          v-if="assetId"
          :to="`/asset-editor?id=${assetId}`"
          class="edit-link"
        >
          <Icon icon="mdi:pencil-outline" />
          <span>进入编辑</span>
        </router-link>
      </div>
    </header>

    <div class="viewer-body">
      <div class="viewport" ref="canvasRef" />

      <Transition name="info-slide">
        <aside v-if="selectedInfo" class="info-panel">
          <div class="info-header">
            <Icon icon="mdi:information-outline" class="info-icon" />
            <span>元器件信息</span>
            <button class="info-close" @click="clearSelection">
              <Icon icon="mdi:close" />
            </button>
          </div>
          <div class="info-body">
            <div class="info-row">
              <span class="info-label">名称</span>
              <span class="info-value">{{ selectedInfo.name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">类型</span>
              <span class="info-value">{{ selectedInfo.type }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">位置</span>
              <span class="info-value mono">{{ selectedInfo.position }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">旋转</span>
              <span class="info-value mono">{{ selectedInfo.rotation }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">缩放</span>
              <span class="info-value mono">{{ selectedInfo.scale }}</span>
            </div>
            <div v-if="selectedInfo.partName" class="info-row">
              <span class="info-label">元器件</span>
              <span class="info-value accent">{{ selectedInfo.partName }}</span>
            </div>
          </div>
        </aside>
      </Transition>
    </div>

    <footer class="viewer-footer">
      <span class="footer-item">
        <Icon icon="mdi:eye-outline" class="footer-icon" />
        只读模式
      </span>
      <span v-if="objectCount > 0" class="footer-item">
        <Icon icon="mdi:cube-outline" class="footer-icon" />
        {{ objectCount }} 个元器件
      </span>
      <span class="footer-spacer" />
      <span class="footer-item hint">鼠标拖拽旋转 · 滚轮缩放 · 右键平移 · 点击查看元器件信息</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import * as THREE from 'three'
import {
  CoreContext,
  createBox,
  createStandardMaterial
} from '@3d-editor/engine'
import { basicPreset } from '@3d-editor/presets'
import { DEFAULT_SCENE_ENV } from '@/config/scene-env'
import { assetStore } from '@/stores/asset-store'
import { loadModelFromResource } from '@/services/model-resource-service'

const route = useRoute()
const canvasRef = ref<HTMLElement>()
const assetId = route.query.id as string | undefined
const assetName = ref('')
const objectCount = ref(0)

let ctx: CoreContext | null = null

interface ObjectInfo {
  name: string
  type: string
  position: string
  rotation: string
  scale: string
  partName?: string
}
const selectedInfo = ref<ObjectInfo | null>(null)

function formatVec(v: THREE.Vector3): string {
  return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`
}
function formatRot(r: THREE.Euler): string {
  const d = THREE.MathUtils.radToDeg
  return `${d(r.x).toFixed(1)}°, ${d(r.y).toFixed(1)}°, ${d(r.z).toFixed(1)}°`
}

function clearSelection() {
  selectedInfo.value = null
  if (ctx) ctx.selection.clear()
}

function handlePick(event: PointerEvent) {
  if (!ctx) return
  const selectableObjects = ctx.scene.children.filter(o => !o.userData?.nonSelectable)
  const result = ctx.selection.pick(event.clientX, event.clientY, ctx.renderer.domElement, selectableObjects)

  if (result.object && !result.object.userData?.nonSelectable) {
    let target = result.object
    while (target.parent && target.parent.type !== 'Scene') {
      target = target.parent
    }
    ctx.selection.select(target)
    selectedInfo.value = {
      name: target.name || '未命名',
      type: target.type,
      position: formatVec(target.position),
      rotation: formatRot(target.rotation),
      scale: formatVec(target.scale),
      partName: target.userData?.partName
    }
  } else {
    clearSelection()
  }
}

async function rebuildObject(schema: any): Promise<THREE.Object3D> {
  if (schema.userData?.sourceResourceId) {
    const group = new THREE.Group()
    group.name = schema.name || ''
    group.visible = schema.visible ?? true
    group.position.fromArray(schema.transform.position)
    group.rotation.set(...(schema.transform.rotation as [number, number, number]))
    group.scale.fromArray(schema.transform.scale)
    if (schema.userData) group.userData = { ...schema.userData }
    try {
      const model = await loadModelFromResource(schema.userData.sourceResourceId)
      group.add(model)
    } catch {
      // 资源缺失时保持占位 Group
    }
    return group
  }

  if (schema.type === 'mesh' && schema.geometry) {
    const p = schema.geometry.parameters || {}
    let geo: THREE.BufferGeometry
    switch (schema.geometry.type) {
      case 'box': geo = createBox(p.width ?? 1, p.height ?? 1, p.depth ?? 1); break
      case 'sphere': geo = new THREE.SphereGeometry(p.radius ?? 1, p.widthSegments ?? 16, p.heightSegments ?? 12); break
      case 'plane': geo = new THREE.PlaneGeometry(p.width ?? 1, p.height ?? 1); break
      default: geo = createBox(1, 1, 1)
    }
    let mat: THREE.Material
    if (!schema.material) {
      mat = createStandardMaterial('#999999')
    } else {
      const matData = Array.isArray(schema.material) ? schema.material[0] : schema.material
      const m = createStandardMaterial(matData.color || '#999999')
      m.metalness = matData.metalness ?? 0.3
      m.roughness = matData.roughness ?? 0.6
      m.opacity = matData.opacity ?? 1
      m.transparent = matData.transparent ?? false
      mat = m
    }
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = schema.name || ''
    mesh.visible = schema.visible ?? true
    mesh.position.fromArray(schema.transform.position)
    mesh.rotation.set(...(schema.transform.rotation as [number, number, number]))
    mesh.scale.fromArray(schema.transform.scale)
    mesh.castShadow = schema.castShadow ?? false
    mesh.receiveShadow = schema.receiveShadow ?? false
    if (schema.userData) mesh.userData = { ...schema.userData }
    if (schema.children) {
      for (const c of schema.children) mesh.add(await rebuildObject(c))
    }
    return mesh
  }

  const g = new THREE.Group()
  g.name = schema.name || ''
  g.visible = schema.visible ?? true
  g.position.fromArray(schema.transform.position)
  g.rotation.set(...(schema.transform.rotation as [number, number, number]))
  g.scale.fromArray(schema.transform.scale)
  if (schema.userData) g.userData = { ...schema.userData }
  if (schema.children) {
    for (const c of schema.children) g.add(await rebuildObject(c))
  }
  return g
}

onMounted(async () => {
  if (!canvasRef.value || !assetId) return

  const record = assetStore.get(assetId)
  if (!record) return

  assetName.value = record.name

  ctx = new CoreContext({
    container: canvasRef.value,
    rendererOptions: { antialias: true, alpha: true }
  })

  await ctx.applyPreset(basicPreset, {
    ...DEFAULT_SCENE_ENV,
    grid: { size: 40, divisions: 40, colorCenterLine: 0x2b2b2b, colorGrid: 0x151515 }
  })

  ctx.axisHelper.setEnabled(false)

  ctx.cameraManager.camera.position.set(8, 12, 16)
  if (ctx.orbit) {
    ctx.orbit.controls.target.set(0, 4, 0)
    ctx.orbit.controls.update()
  }

  let count = 0
  for (const objSchema of record.sceneData.objects) {
    const obj = await rebuildObject(objSchema)
    ctx.scene.add(obj)
    count++
  }
  objectCount.value = count

  ctx.renderer.domElement.addEventListener('pointerdown', handlePick)
})

onBeforeUnmount(() => {
  if (ctx) {
    ctx.renderer.domElement.removeEventListener('pointerdown', handlePick)
    ctx.dispose()
    ctx = null
  }
})
</script>

<style scoped>
.viewer-page {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: var(--color-bg);
  overflow: hidden;
}

.viewer-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px; height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 18px;
  text-decoration: none;
  transition: all var(--transition-fast);
}
.back-btn:hover { background: var(--color-primary-dim); color: var(--color-text); }

.app-brand { display: flex; align-items: center; gap: 8px; }
.brand-icon { font-size: 20px; color: var(--color-primary); }
.brand-text { font-size: 14px; font-weight: 600; letter-spacing: 0.3px; }

.name-badge {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.edit-link {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
  text-decoration: none;
  transition: all var(--transition-fast);
}
.edit-link:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-dim);
}

.viewer-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.viewport {
  width: 100%;
  height: 100%;
}

/* Info panel */
.info-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 260px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}
.info-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  font-size: 13px; font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}
.info-icon { font-size: 16px; color: var(--color-primary); }
.info-close {
  margin-left: auto;
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  background: none; border: none;
  color: var(--color-text-muted); font-size: 14px;
  cursor: pointer; border-radius: 4px;
  transition: all var(--transition-fast);
}
.info-close:hover { background: var(--color-surface-elevated); color: var(--color-text); }

.info-body { padding: 12px 16px; }
.info-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.info-row:last-child { border-bottom: none; }
.info-label { font-size: 11px; color: var(--color-text-muted); }
.info-value { font-size: 12px; color: var(--color-text-secondary); text-align: right; }
.info-value.mono { font-family: 'Consolas', monospace; font-size: 11px; }
.info-value.accent { color: var(--color-accent); }

/* Footer */
.viewer-footer {
  height: 28px;
  display: flex; align-items: center;
  padding: 0 14px; gap: 16px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  font-size: 11px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.footer-item { display: flex; align-items: center; gap: 4px; }
.footer-icon { font-size: 13px; color: var(--color-primary); opacity: 0.6; }
.footer-spacer { flex: 1; }
.footer-item.hint { letter-spacing: 0.3px; }

/* Transitions */
.info-slide-enter-active, .info-slide-leave-active {
  transition: all 200ms ease;
}
.info-slide-enter-from, .info-slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
