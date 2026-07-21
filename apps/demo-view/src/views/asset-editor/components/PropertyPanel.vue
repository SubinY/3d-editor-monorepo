<template>
  <aside class="property-panel">
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <Icon :icon="tab.icon" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div v-if="activeTab === 'properties'" class="tab-content">
      <template v-if="selectedObject">
        <div class="section">
          <div class="section-title">基本信息</div>
          <div class="prop-row">
            <label>名称</label>
            <input type="text" :value="selectedObject.name" class="prop-input" @change="onNameChange" />
          </div>
        </div>

        <div class="section">
          <div class="section-title">变换</div>
          <div class="prop-row">
            <label>位置</label>
            <div class="vec3-inputs">
              <div class="vec3-field" v-for="(axis, i) in ['X', 'Y', 'Z']" :key="axis">
                <span class="axis-label" :class="'axis-' + axis.toLowerCase()">{{ axis }}</span>
                <input
                  type="number"
                  step="0.1"
                  :value="position[i].toFixed(2)"
                  class="num-input"
                  @change="(e) => onTransformChange('position', i, e)"
                />
              </div>
            </div>
          </div>
          <div class="prop-row">
            <label>旋转</label>
            <div class="vec3-inputs">
              <div class="vec3-field" v-for="(axis, i) in ['X', 'Y', 'Z']" :key="axis">
                <span class="axis-label" :class="'axis-' + axis.toLowerCase()">{{ axis }}</span>
                <input
                  type="number"
                  step="1"
                  :value="rotationDeg[i].toFixed(1)"
                  class="num-input"
                  @change="(e) => onRotationChange(i, e)"
                />
              </div>
            </div>
          </div>
          <div class="prop-row">
            <label>缩放</label>
            <div class="vec3-inputs">
              <div class="vec3-field" v-for="(axis, i) in ['X', 'Y', 'Z']" :key="axis">
                <span class="axis-label" :class="'axis-' + axis.toLowerCase()">{{ axis }}</span>
                <input
                  type="number"
                  step="0.1"
                  :value="scale[i].toFixed(2)"
                  class="num-input"
                  @change="(e) => onTransformChange('scale', i, e)"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">钻取</div>
          <div class="prop-row switch-row">
            <label>允许钻取（双击或 Alt+点击）</label>
            <input type="checkbox" :checked="focusEnabled" @change="onFocusToggle" />
          </div>
          <div class="prop-help">
            开启后可在视口中进入只读细节查看；按 Esc 或状态栏“退出”可恢复。
          </div>
        </div>
      </template>
      <div v-else class="empty-hint">
        <Icon icon="mdi:cursor-default-click-outline" class="empty-icon" />
        <span>请先选中一个对象</span>
      </div>
    </div>

    <div v-if="activeTab === 'hierarchy'" class="tab-content tree-content">
      <div v-if="editor.sceneTree.value.length === 0" class="empty-hint">
        <Icon icon="mdi:file-tree-outline" class="empty-icon" />
        <span>场景为空，请从左侧添加元器件</span>
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

    <div v-if="activeTab === 'env'" class="tab-content env-content">
      <div class="section">
        <div class="section-title">背景</div>
        <div class="prop-row">
          <label>类型</label>
          <div class="bg-type-row">
            <label class="bg-type-opt">
              <input
                type="radio"
                name="assetBgType"
                :checked="editor.sceneEnv.value.backgroundType === 'color'"
                @change="editor.sceneEnv.value.backgroundType = 'color'; editor.updateSceneEnv()"
              />
              <span>颜色</span>
            </label>
            <label class="bg-type-opt">
              <input
                type="radio"
                name="assetBgType"
                :checked="editor.sceneEnv.value.backgroundType === 'image'"
                @change="editor.sceneEnv.value.backgroundType = 'image'; editor.updateSceneEnv()"
              />
              <span>图片</span>
            </label>
            <label class="bg-type-opt">
              <input
                type="radio"
                name="assetBgType"
                :checked="editor.sceneEnv.value.backgroundType === 'panorama'"
                @change="editor.sceneEnv.value.backgroundType = 'panorama'; editor.updateSceneEnv()"
              />
              <span>全景图</span>
            </label>
          </div>
        </div>
        <div v-if="editor.sceneEnv.value.backgroundType === 'color'" class="prop-row">
          <label>颜色</label>
          <div class="color-input-row">
            <input
              v-model="editor.sceneEnv.value.backgroundColor"
              type="color"
              class="color-picker"
              @change="editor.updateSceneEnv()"
            />
            <input
              v-model="editor.sceneEnv.value.backgroundColor"
              type="text"
              class="prop-input color-text"
              @change="editor.updateSceneEnv()"
            />
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">模型灯光</div>
        <div class="prop-row">
          <label>环境光强度</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="3"
            :value="editor.sceneEnv.value.ambientIntensity.toFixed(2)"
            class="prop-input"
            @change="(e) => onAssetEnvChange('ambientIntensity', e)"
          />
        </div>
        <div class="prop-row">
          <label>平行光强度</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            :value="editor.sceneEnv.value.dirIntensity.toFixed(2)"
            class="prop-input"
            @change="(e) => onAssetEnvChange('dirIntensity', e)"
          />
        </div>
        <div class="prop-row">
          <label>环境贴图强度</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="3"
            :value="editor.sceneEnv.value.environmentIntensity.toFixed(2)"
            class="prop-input"
            @change="(e) => onAssetEnvChange('environmentIntensity', e)"
          />
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'collision'" class="tab-content collision-content">
      <div v-if="editor.collisionIssues.value.length === 0" class="empty-hint">
        <Icon icon="mdi:shield-check-outline" class="empty-icon" />
        <span>当前无碰撞</span>
      </div>
      <div v-else class="collision-list">
        <div class="collision-header">
          <span>检测到 {{ editor.collisionIssues.value.length }} 处碰撞</span>
          <button class="refresh-btn" @click="editor.runCollisionCheck()">刷新</button>
        </div>
        <div v-for="issue in editor.collisionIssues.value" :key="issue.id" class="collision-item">
          <div class="collision-title">{{ issue.aName }} ↔ {{ issue.bName }}</div>
          <div class="collision-actions">
            <button class="mini-btn" @click="editor.focusObjectById(issue.aId)">定位 A</button>
            <button class="mini-btn" @click="editor.focusObjectById(issue.bId)">定位 B</button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, h } from 'vue'
import { Icon } from '@iconify/vue'
import * as THREE from 'three'
import { useAssetEditor } from '../composables/useAssetEditor'
import type { TreeNodeData } from '../types'

const editor = useAssetEditor()
const activeTab = ref<'properties' | 'hierarchy' | 'collision' | 'env'>('properties')

const tabs = [
  { id: 'properties' as const, label: '属性', icon: 'mdi:tune-variant' },
  { id: 'hierarchy' as const, label: '层级', icon: 'mdi:file-tree' },
  { id: 'collision' as const, label: '碰撞', icon: 'mdi:alert-circle-outline' },
  { id: 'env' as const, label: '环境', icon: 'mdi:image-outline' }
]

const selectedObject = computed(() => {
  editor.selectedIds.value
  return editor.getSelectedObject()
})

const position = computed(() => {
  editor.selectedIds.value
  const obj = editor.getSelectedObject()
  return obj ? obj.position.toArray() : [0, 0, 0]
})

const rotationDeg = computed(() => {
  editor.selectedIds.value
  const obj = editor.getSelectedObject()
  if (!obj) return [0, 0, 0]
  return [
    THREE.MathUtils.radToDeg(obj.rotation.x),
    THREE.MathUtils.radToDeg(obj.rotation.y),
    THREE.MathUtils.radToDeg(obj.rotation.z)
  ]
})

const scale = computed(() => {
  editor.selectedIds.value
  const obj = editor.getSelectedObject()
  return obj ? obj.scale.toArray() : [1, 1, 1]
})

const focusEnabled = computed(() => {
  editor.selectedIds.value
  const obj = editor.getSelectedObject()
  return obj?.userData?.focusEnabled === true
})

function onNameChange(e: Event) {
  if (editor.drillActive.value || editor.mode.value === '3d') return
  const obj = selectedObject.value
  if (obj) obj.name = (e.target as HTMLInputElement).value
}

function onTransformChange(prop: 'position' | 'scale', index: number, e: Event) {
  if (editor.drillActive.value || editor.mode.value === '3d') return
  const obj = selectedObject.value
  if (!obj) return
  const val = parseFloat((e.target as HTMLInputElement).value) || 0
  const arr = obj[prop].toArray()
  arr[index] = val
  obj[prop].fromArray(arr)
}

function onRotationChange(index: number, e: Event) {
  if (editor.drillActive.value || editor.mode.value === '3d') return
  const obj = selectedObject.value
  if (!obj) return
  const deg = parseFloat((e.target as HTMLInputElement).value) || 0
  const arr = [obj.rotation.x, obj.rotation.y, obj.rotation.z]
  arr[index] = THREE.MathUtils.degToRad(deg)
  obj.rotation.set(arr[0], arr[1], arr[2])
}

function onAssetEnvChange(
  key: 'ambientIntensity' | 'dirIntensity' | 'environmentIntensity',
  e: Event
) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(val)) editor.updateSceneEnv({ [key]: val })
}

function onFocusToggle(e: Event) {
  if (editor.drillActive.value) return
  const obj = selectedObject.value
  if (!obj) return
  const enabled = (e.target as HTMLInputElement).checked
  editor.setFocusEnabled(obj.uuid, enabled)
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
            }, expanded.value ? '▾' : '▸')
          : h('span', { class: 'expand-spacer' }),
        h(Icon, { icon: hasChildren.value ? 'mdi:cube-outline' : 'mdi:cube', style: { fontSize: '14px', color: 'var(--color-primary)', flexShrink: 0 } }),
        h('span', { class: 'tree-label' }, props.node.name),
        h('span', {
          class: ['vis-toggle', { hidden: !props.node.visible }],
          onClick: (e: MouseEvent) => { e.stopPropagation(); emit('toggle-visible', props.node.id) }
        }, [
          h(Icon, { icon: props.node.visible ? 'mdi:eye-outline' : 'mdi:eye-off-outline', style: { fontSize: '13px' } })
        ])
      ]),
      hasChildren.value && expanded.value
        ? h('div', { class: 'tree-children' },
            props.node.children.map((child: TreeNodeData) =>
              h(TreeItem, {
                key: child.id,
                node: child,
                selectedIds: props.selectedIds,
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
.property-panel {
  width: 260px;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tab-btn:hover {
  color: var(--color-text-secondary);
}
.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.tree-content {
  padding: 6px 0;
}

.section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.prop-row {
  margin-bottom: 10px;
}
.prop-row > label {
  display: block;
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.switch-row input[type='checkbox'] {
  accent-color: var(--color-primary);
}
.prop-help {
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.prop-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  outline: none;
}
.prop-input:focus {
  border-color: var(--color-border-active);
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
.bg-type-opt input {
  accent-color: var(--color-primary);
}
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

.vec3-inputs {
  display: flex;
  gap: 4px;
}

.vec3-field {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.axis-label {
  padding: 0 6px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
.axis-x { color: #ff6b6b; }
.axis-y { color: #51cf66; }
.axis-z { color: #339af0; }

.num-input {
  width: 100%;
  padding: 5px 4px;
  background: transparent;
  border: none;
  color: var(--color-text);
  font-size: 11px;
  font-family: var(--font-mono);
  outline: none;
}
.num-input::-webkit-inner-spin-button {
  display: none;
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
}
.empty-icon {
  font-size: 32px;
  opacity: 0.3;
}

.tree-list {
  display: flex;
  flex-direction: column;
}

.collision-content {
  display: flex;
  flex-direction: column;
}
.collision-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.collision-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-text-secondary);
}
.refresh-btn {
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}
.refresh-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border-active);
}
.collision-item {
  border: 1px solid rgba(255, 77, 106, 0.25);
  background: rgba(255, 77, 106, 0.08);
  border-radius: var(--radius-sm);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.collision-title {
  color: #ff9cae;
  font-size: 12px;
}
.collision-actions {
  display: flex;
  gap: 6px;
}
.mini-btn {
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}
.mini-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border-active);
}

.tree-node-wrap {
  width: 100%;
}

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
.tree-node:hover {
  background: var(--color-primary-dim);
}
.tree-node.selected {
  background: var(--color-primary-dim);
  color: var(--color-text);
  border-left: 2px solid var(--color-primary);
}

.expand-toggle {
  width: 14px;
  font-size: 10px;
  text-align: center;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
}
.expand-spacer {
  width: 14px;
  flex-shrink: 0;
}

.tree-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vis-toggle {
  opacity: 0.4;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  flex-shrink: 0;
  transition: opacity var(--transition-fast);
}
.vis-toggle:hover {
  opacity: 1;
  background: var(--color-surface-elevated);
}
.vis-toggle.hidden {
  opacity: 0.15;
}
</style>
