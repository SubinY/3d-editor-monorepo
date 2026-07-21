<template>
  <aside class="layout-panel">
    <div class="panel-header">
      <Icon icon="mdi:vector-square" class="header-icon" />
      <span>2D 排布属性</span>
    </div>

    <div class="panel-content">
      <section class="section">
        <div class="section-title">机柜与安装板</div>
        <div class="info-row">
          <span class="label">机柜组件</span>
          <span class="value">{{ cabinetName }}</span>
        </div>
        <div class="info-row">
          <span class="label">面板尺寸</span>
          <span class="value">{{ editor.boardSizeMm.value[0] }} x {{ editor.boardSizeMm.value[1] }} mm</span>
        </div>
      </section>

      <section class="section">
        <div class="section-title">当前元器件</div>
        <template v-if="selectedItem">
          <div class="field-row">
            <label>X (mm)</label>
            <input type="number" class="field-input" :value="selectedItem.xMm" @change="onNumChange('xMm', $event)" />
          </div>
          <div class="field-row">
            <label>Y (mm)</label>
            <input type="number" class="field-input" :value="selectedItem.yMm" @change="onNumChange('yMm', $event)" />
          </div>
          <div class="field-row">
            <label>宽 (mm)</label>
            <input type="number" class="field-input" :value="selectedItem.widthMm" @change="onNumChange('widthMm', $event)" />
          </div>
          <div class="field-row">
            <label>高 (mm)</label>
            <input type="number" class="field-input" :value="selectedItem.heightMm" @change="onNumChange('heightMm', $event)" />
          </div>
          <div class="field-row">
            <label>旋转 (°)</label>
            <input type="number" class="field-input" :value="selectedItem.rotationDeg" @change="onNumChange('rotationDeg', $event)" />
          </div>
          <div class="field-row inline">
            <label>允许钻取（Alt+双击进入，Esc 退出）</label>
            <input type="checkbox" :checked="selectedItem.focusEnabled === true" @change="onFocusChange" />
          </div>
          <div class="field-tip">钻取为只读细节查看，不会进入编辑模式。</div>
          <button class="danger-btn" @click="onRemoveSelected">移除该元器件</button>
        </template>
        <div v-else class="empty-tip">请先在 2D 画布中选中一个元器件。</div>
      </section>

      <section class="section">
        <div class="section-title">元器件列表 ({{ editor.layoutItems.value.length }})</div>
        <div class="item-list">
          <button
            v-for="item in editor.layoutItems.value"
            :key="item.id"
            class="item-row"
            :class="{ active: editor.selectedLayoutItemId.value === item.id }"
            @click="editor.selectLayoutItem(item.id)"
          >
            <span class="item-name">{{ item.name }}</span>
            <span class="item-pos">({{ Math.round(item.xMm) }}, {{ Math.round(item.yMm) }})</span>
          </button>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { componentStore } from '@/stores/component-store'
import type { Layout2DItem } from '@/stores/asset-store'
import { useAssetEditor } from '../composables/useAssetEditor'

const editor = useAssetEditor()

const selectedItem = computed(() => editor.selectedLayoutItem.value)

const cabinetName = computed(() => {
  const cabinetId = editor.cabinetComponentId.value
  if (!cabinetId) return '-'
  return componentStore.get(cabinetId)?.name || cabinetId
})

function onNumChange(field: 'xMm' | 'yMm' | 'widthMm' | 'heightMm' | 'rotationDeg', event: Event) {
  const item = selectedItem.value
  if (!item) return
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  editor.updateLayoutItem(item.id, { [field]: value } as Partial<Layout2DItem>)
}

function onFocusChange(event: Event) {
  const item = selectedItem.value
  if (!item) return
  const checked = (event.target as HTMLInputElement).checked
  editor.updateLayoutItem(item.id, { focusEnabled: checked })
}

function onRemoveSelected() {
  const item = selectedItem.value
  if (!item) return
  editor.removeLayoutItem(item.id)
}
</script>

<style scoped>
.layout-panel {
  width: 300px;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.header-icon {
  color: var(--color-primary);
  font-size: 16px;
}

.panel-content {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.section {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 4px 0;
  gap: 8px;
}

.label {
  color: var(--color-text-muted);
}

.value {
  text-align: right;
}

.field-row {
  margin-bottom: 8px;
}

.field-row label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.field-row.inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.field-row.inline label {
  margin-bottom: 0;
  line-height: 1.35;
}

.field-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  color: var(--color-text);
  font-size: 12px;
  outline: none;
}

.field-input:focus {
  border-color: var(--color-border-active);
}

.field-tip {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-bottom: 8px;
}

.danger-btn {
  width: 100%;
  border: 1px solid rgba(255, 77, 106, 0.35);
  background: rgba(255, 77, 106, 0.12);
  color: #ff7f97;
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  font-size: 12px;
  cursor: pointer;
}

.danger-btn:hover {
  background: rgba(255, 77, 106, 0.18);
}

.empty-tip {
  font-size: 12px;
  color: var(--color-text-muted);
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-row {
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  padding: 8px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
}

.item-row:hover {
  border-color: var(--color-border-active);
}

.item-row.active {
  border-color: var(--color-primary);
  background: var(--color-primary-dim);
  color: var(--color-text);
}

.item-pos {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
</style>
