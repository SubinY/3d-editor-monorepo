<template>
  <aside class="right-panel">
    <div class="panel-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'config' }"
        @click="activeTab = 'config'"
      >
        <Icon icon="mdi:cog-outline" />
        <span>基本配置</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'tree' }"
        @click="activeTab = 'tree'"
      >
        <Icon icon="mdi:file-tree" />
        <span>场景树</span>
      </button>
    </div>

    <!-- 基本配置 Tab -->
    <div v-if="activeTab === 'config'" class="config-content">
      <section class="config-section">
        <div class="section-title">
          <Icon icon="mdi:text-box-outline" />
          <span>场景信息</span>
        </div>
        <div class="field-group">
          <label class="field-label">场景名称</label>
          <input
            v-model="editor.sceneName.value"
            type="text"
            class="field-input"
            placeholder="输入场景名称..."
          />
        </div>
      </section>

      <section class="config-section">
        <div class="section-title">
          <Icon icon="mdi:floor-plan" />
          <span>地板尺寸</span>
        </div>
        <div class="field-row">
          <div class="field-group compact">
            <label class="field-label">宽度 (m)</label>
            <div class="number-input-wrap">
              <button class="step-btn" @click="adjustFloor('width', -10)">
                <Icon icon="mdi:minus" />
              </button>
              <input
                :value="editor.floorWidth.value"
                type="number"
                class="field-input number"
                min="10"
                step="10"
                @change="onFloorWidthChange"
              />
              <button class="step-btn" @click="adjustFloor('width', 10)">
                <Icon icon="mdi:plus" />
              </button>
            </div>
          </div>
          <div class="field-group compact">
            <label class="field-label">深度 (m)</label>
            <div class="number-input-wrap">
              <button class="step-btn" @click="adjustFloor('depth', -10)">
                <Icon icon="mdi:minus" />
              </button>
              <input
                :value="editor.floorDepth.value"
                type="number"
                class="field-input number"
                min="10"
                step="10"
                @change="onFloorDepthChange"
              />
              <button class="step-btn" @click="adjustFloor('depth', 10)">
                <Icon icon="mdi:plus" />
              </button>
            </div>
          </div>
        </div>
        <div class="floor-preview">
          <div class="floor-visual">
            <span class="floor-dim w">{{ editor.floorWidth.value }}m</span>
            <span class="floor-dim d">{{ editor.floorDepth.value }}m</span>
          </div>
        </div>
      </section>

      <section class="config-section">
        <div class="section-title">
          <Icon icon="mdi:image-outline" />
          <span>背景</span>
        </div>
        <div class="field-group">
          <label class="field-label">类型</label>
          <div class="bg-type-row">
            <label class="bg-type-opt">
              <input
                type="radio"
                name="bgType"
                value="color"
                :checked="editor.sceneEnv.value.backgroundType === 'color'"
                @change="onBgTypeChange('color')"
              />
              <span>颜色</span>
            </label>
            <label class="bg-type-opt">
              <input
                type="radio"
                name="bgType"
                value="image"
                :checked="editor.sceneEnv.value.backgroundType === 'image'"
                @change="onBgTypeChange('image')"
              />
              <span>图片</span>
            </label>
            <label class="bg-type-opt">
              <input
                type="radio"
                name="bgType"
                value="panorama"
                :checked="editor.sceneEnv.value.backgroundType === 'panorama'"
                @change="onBgTypeChange('panorama')"
              />
              <span>全景图</span>
            </label>
          </div>
        </div>
        <div v-if="editor.sceneEnv.value.backgroundType === 'color'" class="field-group">
          <label class="field-label">颜色</label>
          <div class="color-input-row">
            <input
              v-model="editor.sceneEnv.value.backgroundColor"
              type="color"
              class="color-picker"
              @change="onSceneEnvChange"
            />
            <input
              v-model="editor.sceneEnv.value.backgroundColor"
              type="text"
              class="field-input color-text"
              @change="onSceneEnvChange"
            />
          </div>
        </div>
        <template v-if="editor.sceneEnv.value.backgroundType === 'image'">
          <div class="field-group">
            <label class="field-label">上传图片</label>
            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              class="file-input-hidden"
              @change="onImageFileChange"
            />
            <button type="button" class="field-btn" @click="imageInputRef?.click()">
              <Icon icon="mdi:folder-open-outline" />
              <span>{{ editor.sceneEnv.value.backgroundImageUrl ? '更换图片' : '选择图片' }}</span>
            </button>
            <div v-if="editor.sceneEnv.value.backgroundImageUrl" class="field-help upload-status">
              已上传
              <button type="button" class="clear-btn" @click="clearImageUrl">清除</button>
            </div>
          </div>
        </template>
        <template v-if="editor.sceneEnv.value.backgroundType === 'panorama'">
          <div class="field-group">
            <label class="field-label">上传全景图</label>
            <input
              ref="panoramaInputRef"
              type="file"
              accept=".hdr,.exr,image/*"
              class="file-input-hidden"
              @change="onPanoramaFileChange"
            />
            <button type="button" class="field-btn" @click="panoramaInputRef?.click()">
              <Icon icon="mdi:folder-open-outline" />
              <span>{{ editor.sceneEnv.value.backgroundPanoramaUrl ? '更换全景图' : '选择全景图' }}</span>
            </button>
            <div class="field-help">支持 HDR/EXR/JPG/PNG 等</div>
            <div v-if="editor.sceneEnv.value.backgroundPanoramaUrl" class="field-help upload-status">
              已上传
              <button type="button" class="clear-btn" @click="clearPanoramaUrl">清除</button>
            </div>
          </div>
        </template>
      </section>

      <section class="config-section">
        <div class="section-title">
          <Icon icon="mdi:lightbulb-outline" />
          <span>模型灯光</span>
        </div>
        <div class="field-group">
          <label class="field-label">环境光强度</label>
          <div class="number-input-wrap">
            <button class="step-btn" @click="adjustSceneEnv('ambientIntensity', -0.1)">
              <Icon icon="mdi:minus" />
            </button>
            <input
              :value="editor.sceneEnv.value.ambientIntensity.toFixed(2)"
              type="number"
              class="field-input number"
              min="0"
              max="3"
              step="0.1"
              @change="onAmbientIntensityChange"
            />
            <button class="step-btn" @click="adjustSceneEnv('ambientIntensity', 0.1)">
              <Icon icon="mdi:plus" />
            </button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">平行光强度</label>
          <div class="number-input-wrap">
            <button class="step-btn" @click="adjustSceneEnv('mainIntensity', -0.2)">
              <Icon icon="mdi:minus" />
            </button>
            <input
              :value="editor.sceneEnv.value.mainIntensity.toFixed(2)"
              type="number"
              class="field-input number"
              min="0"
              max="5"
              step="0.1"
              @change="onMainIntensityChange"
            />
            <button class="step-btn" @click="adjustSceneEnv('mainIntensity', 0.2)">
              <Icon icon="mdi:plus" />
            </button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">环境贴图强度</label>
          <div class="number-input-wrap">
            <button class="step-btn" @click="adjustSceneEnv('environmentIntensity', -0.1)">
              <Icon icon="mdi:minus" />
            </button>
            <input
              :value="editor.sceneEnv.value.environmentIntensity.toFixed(2)"
              type="number"
              class="field-input number"
              min="0"
              max="3"
              step="0.1"
              @change="onEnvironmentIntensityChange"
            />
            <button class="step-btn" @click="adjustSceneEnv('environmentIntensity', 0.1)">
              <Icon icon="mdi:plus" />
            </button>
          </div>
        </div>
      </section>

      <section class="config-section">
        <div class="section-title">
          <Icon icon="mdi:access-point-network" />
          <span>通信配置</span>
          <span class="tag-placeholder">占位</span>
        </div>
        <div class="field-group">
          <label class="field-label">通信协议</label>
          <select v-model="editor.commInfo.value.protocol" class="field-input">
            <option value="">请选择...</option>
            <option value="mqtt">MQTT</option>
            <option value="modbus">Modbus TCP</option>
            <option value="opcua">OPC UA</option>
            <option value="http">HTTP/REST</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">服务器地址</label>
          <input
            v-model="editor.commInfo.value.address"
            type="text"
            class="field-input"
            placeholder="例如：192.168.1.100"
          />
        </div>
        <div class="field-group">
          <label class="field-label">端口号</label>
          <input
            v-model="editor.commInfo.value.port"
            type="text"
            class="field-input"
            placeholder="例如：1883"
          />
        </div>
      </section>
    </div>

    <!-- 场景树 Tab -->
    <div v-else class="tree-content">
      <!-- 选中资产实例时显示编辑入口 -->
      <div v-if="selectedAssetInfo" class="edit-asset-bar">
        <div class="edit-asset-label">
          <Icon icon="mdi:archive-outline" class="edit-asset-icon" />
          <span>已选：{{ selectedAssetInfo.name }}</span>
        </div>
        <button class="edit-asset-btn" @click="onEditAsset">
          <Icon icon="mdi:pencil-box-outline" />
          <span>编辑该资产</span>
        </button>
      </div>
      <div v-if="selectedObject" class="focus-toggle-bar">
        <label class="focus-toggle-label">
          <Icon icon="mdi:magnify-plus-outline" />
          <span>允许钻取查看</span>
        </label>
        <input
          type="checkbox"
          :checked="focusEnabled"
          @change="onFocusToggle"
        />
      </div>
      <div v-if="selectedObject" class="focus-help">
        勾选后：在视口中双击或按住 Alt 点击该对象，会聚焦放大并进入只读查看；按 Esc 或点击底部“退出”可复原。
      </div>
      <div v-if="editor.sceneTree.value.length === 0" class="empty-hint">
        <Icon icon="mdi:file-tree-outline" class="empty-icon" />
        <span>场景为空，从左侧资产库拖入资产</span>
      </div>
      <div v-else class="tree-list">
        <TreeItem
          v-for="node in editor.sceneTree.value"
          :key="node.id"
          :node="node"
          :selected-ids="editor.selectedIds.value"
          :depth="0"
          @select="editor.selectById"
          @toggle-visible="editor.toggleVisibility"
        />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, defineComponent, h, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useSceneEditor } from '../composables/useSceneEditor'
import type { TreeNodeData } from '../types'

const router = useRouter()
const editor = useSceneEditor()
const activeTab = ref<'config' | 'tree'>('config')

const selectedAssetInfo = computed(() => {
  editor.selectedIds.value
  const obj = editor.getSelectedObject()
  const aid = obj?.userData?.assetId
  const name = obj?.userData?.assetName || obj?.name
  if (!aid) return null
  return { id: aid, name: name || '未命名资产' }
})

const selectedObject = computed(() => {
  editor.selectedIds.value
  return editor.getSelectedObject()
})

const focusEnabled = computed(() => selectedObject.value?.userData?.focusEnabled === true)

function onEditAsset() {
  if (!selectedAssetInfo.value) return
  const sceneId = editor.currentSceneId.value
  const query: Record<string, string> = { id: selectedAssetInfo.value.id, from: 'scene' }
  if (sceneId) query.sceneId = sceneId
  router.push({ path: '/asset-editor', query })
}

function onFocusToggle(e: Event) {
  if (editor.drillActive.value) return
  const obj = selectedObject.value
  if (!obj) return
  const enabled = (e.target as HTMLInputElement).checked
  editor.setFocusEnabled(obj.uuid, enabled)
}

function onFloorWidthChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (val >= 10) editor.resizeFloor(val, editor.floorDepth.value)
}

function onFloorDepthChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (val >= 10) editor.resizeFloor(editor.floorWidth.value, val)
}

function adjustFloor(axis: 'width' | 'depth', delta: number) {
  if (axis === 'width') {
    editor.resizeFloor(editor.floorWidth.value + delta, editor.floorDepth.value)
  } else {
    editor.resizeFloor(editor.floorWidth.value, editor.floorDepth.value + delta)
  }
}

const imageInputRef = ref<HTMLInputElement | null>(null)
const panoramaInputRef = ref<HTMLInputElement | null>(null)
const imageBlobUrlRef = ref<string | null>(null)
const panoramaBlobUrlRef = ref<string | null>(null)

function revokeBlobUrl(url: string | null) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function onBgTypeChange(type: 'color' | 'image' | 'panorama') {
  // 互斥：切换类型时清空其他类型的 URL
  if (type === 'color') {
    revokeBlobUrl(imageBlobUrlRef.value)
    revokeBlobUrl(panoramaBlobUrlRef.value)
    imageBlobUrlRef.value = null
    panoramaBlobUrlRef.value = null
    editor.updateSceneEnv({
      backgroundType: 'color',
      backgroundImageUrl: null,
      backgroundPanoramaUrl: null
    })
  } else if (type === 'image') {
    revokeBlobUrl(panoramaBlobUrlRef.value)
    panoramaBlobUrlRef.value = null
    editor.updateSceneEnv({
      backgroundType: 'image',
      backgroundPanoramaUrl: null
    })
  } else {
    revokeBlobUrl(imageBlobUrlRef.value)
    imageBlobUrlRef.value = null
    editor.updateSceneEnv({
      backgroundType: 'panorama',
      backgroundImageUrl: null
    })
  }
}

function onImageFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  revokeBlobUrl(imageBlobUrlRef.value)
  const url = URL.createObjectURL(file)
  imageBlobUrlRef.value = url
  editor.updateSceneEnv({ backgroundImageUrl: url })
}

function onPanoramaFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  revokeBlobUrl(panoramaBlobUrlRef.value)
  const url = URL.createObjectURL(file)
  panoramaBlobUrlRef.value = url
  editor.updateSceneEnv({ backgroundPanoramaUrl: url })
}

function clearImageUrl() {
  revokeBlobUrl(imageBlobUrlRef.value)
  imageBlobUrlRef.value = null
  editor.updateSceneEnv({ backgroundImageUrl: null })
}

function clearPanoramaUrl() {
  revokeBlobUrl(panoramaBlobUrlRef.value)
  panoramaBlobUrlRef.value = null
  editor.updateSceneEnv({ backgroundPanoramaUrl: null })
}

function onSceneEnvChange() {
  editor.updateSceneEnv()
}

function adjustSceneEnv(
  key: 'ambientIntensity' | 'mainIntensity' | 'environmentIntensity',
  delta: number
) {
  const v = editor.sceneEnv.value
  let val = v[key] + delta
  val = Math.max(0, Math.min(key === 'mainIntensity' ? 5 : 3, val))
  editor.updateSceneEnv({ [key]: val })
}

function onAmbientIntensityChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(val)) editor.updateSceneEnv({ ambientIntensity: val })
}

function onMainIntensityChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(val)) editor.updateSceneEnv({ mainIntensity: val })
}

function onEnvironmentIntensityChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(val)) editor.updateSceneEnv({ environmentIntensity: val })
}

const TreeItem = defineComponent({
  name: 'TreeItem',
  props: {
    node: { type: Object as () => TreeNodeData, required: true },
    selectedIds: { type: Array as () => string[], required: true },
    depth: { type: Number, default: 0 }
  },
  emits: ['select', 'toggle-visible'],
  setup(props, { emit }) {
    const expanded = ref(true)
    const isSelected = computed(() => props.selectedIds.includes(props.node.id))
    const hasChildren = computed(() => props.node.children && props.node.children.length > 0)

    return () => h('div', { class: 'tree-node-wrap' }, [
      h('div', {
        class: ['tree-node', { selected: isSelected.value }],
        style: { paddingLeft: `${props.depth * 16 + 8}px` },
        onClick: () => emit('select', props.node.id)
      }, [
        hasChildren.value
          ? h('span', {
              class: ['expand-toggle', { open: expanded.value }],
              onClick: (e: MouseEvent) => { e.stopPropagation(); expanded.value = !expanded.value }
            }, expanded.value ? '\u25BE' : '\u25B8')
          : h('span', { class: 'expand-spacer' }),
        h(Icon, { icon: 'mdi:cube-outline', style: { fontSize: '14px', color: 'var(--color-accent)', flexShrink: 0 } }),
        h('span', { class: 'tree-label' }, props.node.name),
        h('span', {
          class: ['vis-toggle', { hidden: !props.node.visible }],
          onClick: (e: MouseEvent) => { e.stopPropagation(); emit('toggle-visible', props.node.id) }
        }, [h(Icon, { icon: props.node.visible ? 'mdi:eye-outline' : 'mdi:eye-off-outline', style: { fontSize: '13px' } })])
      ]),
      hasChildren.value && expanded.value
        ? h('div', { class: 'tree-children' },
            props.node.children.map((child: TreeNodeData) =>
              h(TreeItem, {
                key: child.id, node: child, selectedIds: props.selectedIds,
                depth: props.depth + 1,
                onSelect: (id: string) => emit('select', id),
                onToggleVisible: (id: string) => emit('toggle-visible', id)
              })
            )
          )
        : null
    ])
  }
})
</script>

<style scoped>
.right-panel {
  width: 280px;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tab-btn:hover { color: var(--color-text-secondary); }
.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

/* 基本配置 */
.config-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.config-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}
.config-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.section-title .iconify { font-size: 14px; color: var(--color-primary); }

.tag-placeholder {
  margin-left: auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}

.field-group { margin-bottom: 10px; }
.field-group:last-child { margin-bottom: 0; }
.field-group.compact { flex: 1; }

.field-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  padding: 7px 10px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  outline: none;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}
.field-input:focus { border-color: var(--color-border-active); }
.field-input::placeholder { color: var(--color-text-muted); }
.field-input.number {
  text-align: center;
  padding: 7px 4px;
  -moz-appearance: textfield;
}
.field-input.number::-webkit-inner-spin-button,
.field-input.number::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

select.field-input {
  cursor: pointer;
  appearance: auto;
}

.field-row {
  display: flex;
  gap: 8px;
}

.number-input-wrap {
  display: flex;
  align-items: stretch;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.number-input-wrap .field-input {
  border: none;
  border-radius: 0;
  flex: 1;
  min-width: 0;
}
.step-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  background: var(--color-surface-elevated);
  border: none;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.step-btn:hover {
  background: var(--color-primary-dim);
  color: var(--color-primary);
}

.floor-preview {
  margin-top: 10px;
  display: flex;
  justify-content: center;
}
.floor-visual {
  position: relative;
  width: 80px;
  height: 50px;
  border: 2px solid var(--color-primary);
  border-radius: 4px;
  opacity: 0.5;
}
.floor-dim {
  position: absolute;
  font-size: 10px;
  color: var(--color-primary);
  font-weight: 600;
}
.floor-dim.w {
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
}
.floor-dim.d {
  right: -32px;
  top: 50%;
  transform: translateY(-50%);
}

.bg-type-row {
  display: flex;
  gap: 12px;
}
.bg-type-opt {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.bg-type-opt input { accent-color: var(--color-primary); }

.color-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.color-picker {
  width: 36px;
  height: 28px;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: var(--color-surface-elevated);
}
.color-text {
  flex: 1;
  min-width: 0;
}

.field-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.field-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.field-btn:not(:disabled):hover { border-color: var(--color-primary); color: var(--color-primary); }
.field-help {
  margin-top: 4px;
  font-size: 10px;
  color: var(--color-text-muted);
}
.file-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
.upload-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.clear-btn {
  padding: 0 6px;
  font-size: 10px;
  color: var(--color-primary);
  background: none;
  border: none;
  cursor: pointer;
}
.clear-btn:hover { text-decoration: underline; }

/* 场景树 */
.tree-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.edit-asset-bar {
  flex-shrink: 0;
  padding: 12px;
  margin: 8px;
  background: var(--color-primary-dim);
  border: 1px solid rgba(77, 163, 255, 0.3);
  border-radius: var(--radius-md);
}
.edit-asset-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}
.edit-asset-icon {
  font-size: 16px;
  color: var(--color-primary);
}
.edit-asset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.edit-asset-btn:hover {
  filter: brightness(1.15);
  box-shadow: 0 0 12px rgba(77, 163, 255, 0.4);
}

.focus-toggle-bar {
  flex-shrink: 0;
  padding: 10px 12px;
  margin: 0 8px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.focus-toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.focus-toggle-bar input[type='checkbox'] {
  accent-color: var(--color-primary);
}
.focus-help {
  margin: 0 8px 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.45;
  padding: 0 4px;
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 16px;
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
}
.empty-icon { font-size: 28px; opacity: 0.25; }

.tree-list { padding: 4px 0; }

.tree-node-wrap { width: 100%; }
.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-secondary);
  transition: background var(--transition-fast);
}
.tree-node:hover { background: var(--color-primary-dim); }
.tree-node.selected {
  background: var(--color-primary-dim);
  color: var(--color-text);
  border-left: 2px solid var(--color-accent);
}

.expand-toggle {
  width: 14px; font-size: 10px; text-align: center;
  color: var(--color-text-muted); cursor: pointer; flex-shrink: 0;
}
.expand-spacer { width: 14px; flex-shrink: 0; }

.tree-label {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.vis-toggle {
  opacity: 0.4; cursor: pointer; padding: 2px; border-radius: 3px; flex-shrink: 0;
  transition: opacity var(--transition-fast);
}
.vis-toggle:hover { opacity: 1; background: var(--color-surface-elevated); }
.vis-toggle.hidden { opacity: 0.15; }
</style>
