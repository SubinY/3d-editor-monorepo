<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { CATALOG_ITEM_MIME, createEditor } from '@3d-editor/editor'
import type {
  CatalogItem,
  DocumentKind,
  EditorDocument,
  EditorDocumentJSON,
  EditorSession,
  MemoryCatalog,
  WallJSON
} from '@3d-editor/editor'

const props = defineProps<{
  kind: DocumentKind
  catalog: MemoryCatalog
  initial: EditorDocumentJSON
}>()

const emit = defineEmits<{
  save: [json: EditorDocumentJSON]
  back: []
}>()

// -- 状态 ----------------------------------------------------------------------

const el2d = ref<HTMLElement>()
const el3d = ref<HTMLElement>()
const doc = shallowRef<EditorDocument>()
let session: EditorSession | undefined

const docName = ref('')
const tool = ref<'select' | 'wall'>('select')
const viewMode = ref<'2d' | '3d' | 'split'>('split')
const canUndo = ref(false)
const canRedo = ref(false)
const toast = ref('')
const toastKind = ref<'info' | 'error'>('info')
let toastTimer = 0

interface AssetGroup {
  key: string
  label: string
  items: CatalogItem[]
}
const groups = ref<AssetGroup[]>([])

const selectedNode = reactive({
  id: '',
  name: '',
  x: 0,
  y: 0,
  z: 0,
  yawDeg: 0,
  catalog: ''
})
const selectedWall = shallowRef<WallJSON | null>(null)

const boundsForm = reactive({ width: 0, depth: 0, height: 0 })

const isScene = computed(() => props.kind === 'scene')

// -- 提示 ----------------------------------------------------------------------

function showToast(message: string, kind: 'info' | 'error' = 'info') {
  toast.value = message
  toastKind.value = kind
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 2600)
}

function deniedMessage(reason: string): string {
  if (reason.startsWith('collision:')) {
    return `与「${reason.slice('collision:'.length)}」位置冲突，已拒绝`
  }
  return `操作被拒绝：${reason}`
}

// -- 同步 ----------------------------------------------------------------------

function refreshHistoryState() {
  canUndo.value = doc.value?.history.canUndo() ?? false
  canRedo.value = doc.value?.history.canRedo() ?? false
}

function refreshBoundsForm() {
  const d = doc.value
  if (!d) return
  boundsForm.width = d.bounds.width
  boundsForm.depth = d.bounds.depth
  boundsForm.height = d.bounds.height ?? 0
}

function refreshSelected() {
  const d = doc.value
  const id = d?.selection.first()
  selectedWall.value = null
  if (!d || !id) {
    selectedNode.id = ''
    return
  }
  const node = d.getNode(id)
  if (node) {
    selectedNode.id = id
    selectedNode.name = node.name ?? ''
    selectedNode.x = Number(node.transform.position[0].toFixed(2))
    selectedNode.y = Number(node.transform.position[1].toFixed(2))
    selectedNode.z = Number(node.transform.position[2].toFixed(2))
    selectedNode.yawDeg = Number(
      (((isScene.value ? node.transform.rotation[1] : node.transform.rotation[2]) * 180) / Math.PI).toFixed(1)
    )
    selectedNode.catalog = node.catalogRef ? `${node.catalogRef.id}@${node.catalogRef.version}` : '-'
    return
  }
  selectedNode.id = ''
  const wall = d.getWall(id)
  if (wall) selectedWall.value = { ...wall }
}

// -- 生命周期 ------------------------------------------------------------------

onMounted(async () => {
  session = await createEditor({
    catalog: props.catalog,
    document: props.initial,
    mount: {
      canvas2d: el2d.value,
      canvas3d: el3d.value
    },
    onDenied: reason => showToast(deniedMessage(reason), 'error')
  })

  const d = session.document
  doc.value = d
  docName.value = d.name
  refreshBoundsForm()

  d.on('change', () => {
    refreshHistoryState()
    refreshSelected()
    refreshBoundsForm()
  })
  d.on('selection:changed', refreshSelected)

  const items = await props.catalog.list({ placeableIn: props.kind })
  if (isScene.value) {
    groups.value = [
      { key: 'fixture', label: '墙体构件', items: items.filter(item => item.category === 'fixture') },
      { key: 'equipment', label: '电柜', items: items.filter(item => item.category === 'equipment') }
    ]
  } else {
    groups.value = [
      { key: 'component', label: '元器件', items: items.filter(item => item.category === 'component') }
    ]
  }

  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.clearTimeout(toastTimer)
  session?.dispose()
  session = undefined
})

function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

  const mod = event.ctrlKey || event.metaKey
  if (mod && (event.key === 'z' || event.key === 'Z')) {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if (mod && (event.key === 'y' || event.key === 'Y')) {
    event.preventDefault()
    redo()
    return
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeSelected()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    session?.viewport2d?.endWallChain()
    if (tool.value === 'wall') {
      setTool('select')
    } else {
      doc.value?.selection.clear()
    }
    return
  }

  // 场景：W 在选择 / 画墙间切换
  if (isScene.value && (event.key === 'w' || event.key === 'W') && !mod) {
    event.preventDefault()
    setTool(tool.value === 'wall' ? 'select' : 'wall')
  }
}

// -- 工具条 ----------------------------------------------------------------------

function setTool(next: 'select' | 'wall') {
  tool.value = next
  session?.viewport2d?.setTool(next)
  if (next === 'wall' && viewMode.value === '3d') {
    setViewMode('split')
  }
}

async function setViewMode(mode: '2d' | '3d' | 'split') {
  viewMode.value = mode
  await nextTick()
  session?.viewport2d?.resize()
  window.dispatchEvent(new Event('resize'))
  if (mode !== '3d') session?.viewport2d?.fitBounds()
}

function undo() {
  doc.value?.history.undo()
}

function redo() {
  doc.value?.history.redo()
}

function fitView() {
  session?.viewport2d?.fitBounds()
}

function save() {
  const d = doc.value
  if (!d) return
  d.name = docName.value || d.name
  emit('save', d.toJSON())
  showToast(isScene.value ? '已保存电柜室' : '已保存电柜（同时发布为柜资产）')
}

// -- 素材拖放 ----------------------------------------------------------------------

function onAssetDragStart(event: DragEvent, item: CatalogItem) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(CATALOG_ITEM_MIME, JSON.stringify(item))
  event.dataTransfer.effectAllowed = 'copy'
  session?.viewport2d?.beginExternalDrag(item)
}

function onAssetDragEnd() {
  session?.viewport2d?.endExternalDrag()
}

// -- 属性面板 ----------------------------------------------------------------------

function applyNodeTransform() {
  if (!selectedNode.id) return
  const yaw = (selectedNode.yawDeg * Math.PI) / 180
  const result = doc.value?.commands.transformNode(selectedNode.id, {
    position: isScene.value
      ? [selectedNode.x, selectedNode.y, selectedNode.z]
      : [selectedNode.x, selectedNode.y, selectedNode.z],
    rotation: isScene.value ? [0, yaw, 0] : [0, 0, yaw]
  })
  if (result && !result.ok && result.denied) {
    showToast(deniedMessage(result.denied), 'error')
    refreshSelected()
  }
}

function applyNodeName() {
  if (!selectedNode.id) return
  doc.value?.commands.updateNode(selectedNode.id, { name: selectedNode.name })
}

function removeSelected() {
  const d = doc.value
  if (!d) return
  if (selectedNode.id) {
    d.commands.removeNode(selectedNode.id)
    return
  }
  if (selectedWall.value) {
    d.commands.removeWall(selectedWall.value.id)
    d.selection.clear()
  }
}

function applyBounds() {
  doc.value?.commands.setBounds({
    width: boundsForm.width || undefined,
    depth: boundsForm.depth || undefined,
    height: boundsForm.height || undefined
  })
  session?.viewport2d?.fitBounds()
}

function wallLength(wall: WallJSON): string {
  return Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]).toFixed(2)
}
</script>

<template>
  <div class="workbench">
    <!-- 顶部工具条 -->
    <header class="topbar">
      <button class="icon-btn" title="返回列表" @click="emit('back')">←</button>
      <input v-model="docName" class="doc-name" />
      <span class="kind-badge">{{ isScene ? '电柜室' : '电柜' }}</span>

      <div class="tool-seg">
        <button :class="{ active: tool === 'select' }" title="选择 (W 切换)" @click="setTool('select')">选择</button>
        <button v-if="isScene" :class="{ active: tool === 'wall' }" title="画墙 (W)" @click="setTool('wall')">画墙</button>
      </div>

      <div class="tool-seg">
        <button :disabled="!canUndo" title="撤销" @click="undo">↺</button>
        <button :disabled="!canRedo" title="重做" @click="redo">↻</button>
        <button title="删除选中 (Del)" @click="removeSelected">🗑</button>
        <button title="视图适配" @click="fitView">⛶</button>
      </div>

      <div class="spacer" />

      <div class="tool-seg view-seg">
        <button :class="{ active: viewMode === '2d' }" @click="setViewMode('2d')">2D</button>
        <button :class="{ active: viewMode === 'split' }" @click="setViewMode('split')">并排</button>
        <button :class="{ active: viewMode === '3d' }" @click="setViewMode('3d')">3D</button>
      </div>
      <button class="primary" @click="save">保存</button>
    </header>

    <div class="body">
      <!-- 左：分类素材 -->
      <aside class="left">
        <template v-if="isScene">
          <div class="group">
            <div class="group-label">墙体</div>
            <div class="asset tool-asset" :class="{ active: tool === 'wall' }" @click="setTool(tool === 'wall' ? 'select' : 'wall')">
              <span class="swatch wall-swatch">▭</span>
              <div class="meta">
                <div class="name">画墙工具</div>
                <div class="dim">左键连续落点 · 右键/Esc 结束</div>
              </div>
            </div>
          </div>
        </template>

        <div v-for="group in groups" :key="group.key" class="group">
          <div class="group-label">{{ group.label }}</div>
          <div
            v-for="item in group.items"
            :key="item.id + item.version"
            class="asset"
            draggable="true"
            @dragstart="onAssetDragStart($event, item)"
            @dragend="onAssetDragEnd"
          >
            <span class="swatch" :style="{ background: item.thumb ?? '#3f7fbf' }" />
            <div class="meta">
              <div class="name">{{ item.name }}</div>
              <div class="dim">{{ item.footprint.width }} × {{ item.footprint.depth }} m</div>
            </div>
            <span class="grab">⠿</span>
          </div>
          <div v-if="!group.items.length" class="group-empty">暂无条目</div>
        </div>
        <p class="hint">拖拽素材到 2D 画布放置；重叠位置会被碰撞检测拒绝。</p>
      </aside>

      <!-- 中：2D / 3D -->
      <main class="center">
        <div v-show="viewMode !== '3d'" class="pane">
          <div class="pane-label">2D 平面</div>
          <div ref="el2d" class="viewport" />
        </div>
        <div v-show="viewMode !== '2d'" class="pane">
          <div class="pane-label">3D 预览</div>
          <div ref="el3d" class="viewport" />
        </div>
      </main>

      <!-- 右：属性 -->
      <aside class="right">
        <div v-if="!isScene" class="section">
          <div class="section-title">柜体尺寸</div>
          <div class="row3">
            <label>宽 (m)<input v-model.number="boundsForm.width" type="number" step="0.1" min="0.2" @change="applyBounds" /></label>
            <label>深 (m)<input v-model.number="boundsForm.depth" type="number" step="0.1" min="0.2" @change="applyBounds" /></label>
            <label>高 (m)<input v-model.number="boundsForm.height" type="number" step="0.1" min="0.5" @change="applyBounds" /></label>
          </div>
        </div>

        <div class="section">
          <div class="section-title">选中对象</div>
          <template v-if="selectedNode.id">
            <label>名称<input v-model="selectedNode.name" @change="applyNodeName" /></label>
            <div class="row3">
              <label>X 宽 (m)<input v-model.number="selectedNode.x" type="number" step="0.1" @change="applyNodeTransform" /></label>
              <label v-if="isScene">Z 深 (m)<input v-model.number="selectedNode.z" type="number" step="0.1" @change="applyNodeTransform" /></label>
              <label v-else>Y 高 (m)<input v-model.number="selectedNode.y" type="number" step="0.1" @change="applyNodeTransform" /></label>
              <label>朝向 (°)<input v-model.number="selectedNode.yawDeg" type="number" step="15" @change="applyNodeTransform" /></label>
            </div>
            <div class="kv">资产：{{ selectedNode.catalog }}</div>
            <button class="danger" @click="removeSelected">删除节点</button>
          </template>
          <template v-else-if="selectedWall">
            <div class="kv">墙段长度：{{ wallLength(selectedWall) }} m</div>
            <div class="kv">高 {{ selectedWall.height ?? 3 }} m · 厚 {{ selectedWall.thickness ?? 0.2 }} m</div>
            <button class="danger" @click="removeSelected">删除墙段</button>
          </template>
          <p v-else class="hint">在 2D/3D 画布中点击对象查看属性；空白处点击取消选中。</p>
        </div>

        <div v-if="!isScene" class="section">
          <div class="section-title">操作提示</div>
          <p class="hint">
            2D 为柜内立面（宽 × 高），从开门方向往里看。<br />
            拖元器件到立面布置；Y=0 为柜底。3D 为五面开口柜体。<br />
            选中后拖主体平移，拖外侧圆环手柄旋转；拖动时显示对齐辅助线。<br />
            Ctrl+Z / Ctrl+Shift+Z 撤销重做 · Delete 删除 · Esc 清选中
          </p>
        </div>

        <div v-if="isScene" class="section">
          <div class="section-title">操作提示</div>
          <p class="hint">
            画墙：左键连续落点，右键或 Esc 结束当前链；封闭墙体会自动填充地板。<br />
            W 切换「选择 / 画墙」· Ctrl+Z / Ctrl+Shift+Z 撤销重做 · Delete 删除 · Esc 取消工具态/清选中<br />
            门 / 窗 / 柱拖近墙体会自动贴墙；物件拖动时有对齐辅助线。<br />
            平移：中键或 Shift+左键；缩放：滚轮。选中后拖主体平移，拖外侧圆环旋转。
          </p>
        </div>
      </aside>
    </div>

    <transition name="fade">
      <div v-if="toast" class="toast" :class="toastKind">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #d5e0ec;
  background: #0b111b;
  position: relative;
}

/* -- 顶部 -- */
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #101823;
  border-bottom: 1px solid #1d2c3e;
}
.icon-btn {
  font-size: 15px;
  padding: 4px 10px;
}
.doc-name {
  width: 200px;
  background: transparent;
  border: 1px solid transparent;
  color: #e8f1fa;
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
  padding: 5px 8px;
}
.doc-name:hover,
.doc-name:focus {
  border-color: #2c3e52;
  background: #16212e;
  outline: none;
}
.kind-badge {
  font-size: 11px;
  color: #39d2ff;
  border: 1px solid rgba(57, 210, 255, 0.35);
  border-radius: 10px;
  padding: 1px 9px;
}
.tool-seg {
  display: flex;
  gap: 2px;
  background: #16212e;
  border: 1px solid #22314400;
  border-radius: 7px;
  padding: 2px;
}
.spacer {
  flex: 1;
}
button {
  background: transparent;
  color: #cfe0f0;
  border: 1px solid transparent;
  border-radius: 5px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
}
button:hover {
  background: #1d2a3a;
}
button:disabled {
  opacity: 0.35;
  cursor: default;
}
button.active {
  background: #1f6feb;
  color: #fff;
}
button.primary {
  background: #1f6feb;
  color: #fff;
  padding: 6px 18px;
  border-radius: 6px;
}
button.danger {
  width: 100%;
  margin-top: 10px;
  background: #221419;
  border: 1px solid #4a2a2a;
  color: #ff8f8f;
}

/* -- 主体 -- */
.body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.left,
.right {
  width: 236px;
  padding: 14px 12px;
  background: #0e1621;
  overflow-y: auto;
  flex-shrink: 0;
}
.left {
  border-right: 1px solid #1d2c3e;
}
.right {
  border-left: 1px solid #1d2c3e;
}
.group {
  margin-bottom: 16px;
}
.group-label,
.section-title {
  font-size: 11px;
  letter-spacing: 1px;
  color: #5d7188;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.group-empty {
  font-size: 12px;
  color: #44556b;
}
.asset {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 9px;
  margin-bottom: 6px;
  background: #131e2b;
  border: 1px solid #1f2f43;
  border-radius: 7px;
  cursor: grab;
  user-select: none;
}
.asset:hover {
  border-color: #2e639e;
}
.asset.active {
  border-color: #39d2ff;
}
.tool-asset {
  cursor: pointer;
}
.swatch {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  flex-shrink: 0;
}
.wall-swatch {
  display: grid;
  place-items: center;
  background: #1d2a3a;
  color: #9db4c8;
}
.meta {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 13px;
}
.dim {
  font-size: 11px;
  color: #5d7188;
  margin-top: 1px;
}
.grab {
  color: #33465e;
  font-size: 13px;
}

/* -- 画布 -- */
.center {
  flex: 1;
  display: flex;
  min-width: 0;
  gap: 1px;
  background: #1d2c3e;
}
.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #0b111b;
}
.pane-label {
  padding: 5px 12px;
  font-size: 11px;
  letter-spacing: 1px;
  color: #5d7188;
  background: #0e1621;
  border-bottom: 1px solid #1d2c3e;
}
.viewport {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

/* -- 属性 -- */
.section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #16222f;
}
label {
  display: block;
  font-size: 12px;
  color: #8ea4bd;
  margin-bottom: 8px;
}
input {
  width: 100%;
  margin-top: 3px;
  background: #16212e;
  color: #d5e0ec;
  border: 1px solid #2c3e52;
  border-radius: 5px;
  padding: 5px 8px;
  font-size: 13px;
}
.row3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}
.kv {
  font-size: 12px;
  color: #8ea4bd;
  margin: 6px 0;
  word-break: break-all;
}
.hint {
  font-size: 12px;
  color: #4d6076;
  line-height: 1.7;
  margin: 0;
}

/* -- toast -- */
.toast {
  position: absolute;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  padding: 8px 18px;
  border-radius: 7px;
  font-size: 13px;
  background: #12283c;
  border: 1px solid #2e639e;
  color: #cfe6ff;
  z-index: 10;
  pointer-events: none;
}
.toast.error {
  background: #2c1519;
  border-color: #7a3030;
  color: #ffb4b4;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
