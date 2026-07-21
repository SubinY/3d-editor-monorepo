<template>
  <header class="editor-toolbar">
    <div class="toolbar-left">
      <router-link v-if="!fromScene" :to="backRoute" class="back-btn" :title="backTitle">
        <Icon icon="mdi:arrow-left" />
      </router-link>
      <button v-else class="back-btn" :title="backTitle" @click="onBackClick">
        <Icon icon="mdi:arrow-left" />
      </button>

      <div class="app-brand">
        <Icon icon="mdi:cube-scan" class="brand-icon" />
        <span class="brand-text">资产编辑器</span>
      </div>

      <div class="divider" />

      <button class="tool-btn" title="新建（清空）" @click="onNew">
        <Icon icon="mdi:file-plus-outline" />
      </button>
      <button class="tool-btn" title="撤销 (Ctrl+Z)" :disabled="editor.mode.value === '3d'" @click="editor.undo()">
        <Icon icon="mdi:undo" />
      </button>
      <button class="tool-btn" title="重做 (Ctrl+Y)" :disabled="editor.mode.value === '3d'" @click="editor.redo()">
        <Icon icon="mdi:redo" />
      </button>

      <div class="divider" />

      <button
        v-for="tool in transformTools"
        :key="tool.mode"
        class="tool-btn"
        :class="{ active: editor.currentTool.value === tool.mode }"
        :title="tool.title"
        :disabled="editor.mode.value === '3d'"
        @click="editor.setTool(tool.mode)"
      >
        <Icon :icon="tool.icon" />
        <span class="tool-label">{{ tool.label }}</span>
      </button>

      <div class="divider" />

      <button
        class="tool-btn danger"
        title="删除选中 (Delete)"
        :disabled="editor.selectedIds.value.length === 0 || editor.mode.value === '3d'"
        @click="editor.deleteSelection()"
      >
        <Icon icon="mdi:delete-outline" />
      </button>
    </div>

    <div class="toolbar-right">
      <span v-if="editor.currentAssetName.value" class="asset-name-badge">
        <Icon icon="mdi:tag-outline" />
        {{ editor.currentAssetName.value }}
      </span>
      <button class="save-btn" @click="onSaveClick">
        <Icon icon="mdi:content-save-outline" />
        <span>{{ editor.currentAssetId.value ? '覆盖保存' : '保存资产' }}</span>
      </button>
      <button v-if="fromScene" class="return-btn" @click="onSaveAndReturn">
        <Icon icon="mdi:arrow-left-bold" />
        <span>保存并返回场景</span>
      </button>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showSaveDialog" class="modal-overlay" @click.self="showSaveDialog = false">
        <div class="modal-card">
          <div class="modal-header">
            <Icon icon="mdi:content-save-check-outline" class="modal-icon" />
            <span>保存资产</span>
          </div>
          <div class="modal-body">
            <label class="field-label">资产名称</label>
            <input
              ref="nameInputRef"
              v-model="assetName"
              type="text"
              class="field-input"
              placeholder="例如：低压柜-A01"
              @keydown.enter="onSave"
            />
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showSaveDialog = false">取消</button>
            <button class="btn-confirm" :disabled="!assetName.trim()" @click="onSave">
              <Icon icon="mdi:check" />
              保存
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toastMsg" class="toast">
        <Icon icon="mdi:check-circle" class="toast-icon" />
        {{ toastMsg }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAssetEditor } from '../composables/useAssetEditor'
import type { TransformMode } from '../types'

const route = useRoute()
const router = useRouter()
const editor = useAssetEditor()
const showSaveDialog = ref(false)
const assetName = ref('')
const nameInputRef = ref<HTMLInputElement>()
const toastMsg = ref('')
const pendingReturn = ref(false)

const fromScene = computed(() => route.query.from === 'scene')
const sceneReturnId = computed(() => route.query.sceneId as string | undefined)

const backRoute = computed(() => {
  if (fromScene.value && sceneReturnId.value) return `/scene-editor?id=${sceneReturnId.value}`
  if (fromScene.value) return '/scene-editor'
  return '/asset-library'
})

const backTitle = computed(() => (fromScene.value ? '返回场景编辑器' : '返回资产库'))

const transformTools: { mode: TransformMode; label: string; title: string; icon: string }[] = [
  { mode: 'translate', label: '移动', title: '移动 (G/T)', icon: 'mdi:cursor-move' },
  { mode: 'rotate', label: '旋转', title: '旋转 (R)', icon: 'mdi:rotate-3d-variant' },
  { mode: 'scale', label: '缩放', title: '缩放 (S)', icon: 'mdi:arrow-expand-all' }
]

watch(showSaveDialog, value => {
  if (!value) return
  assetName.value = editor.currentAssetName.value || ''
  nextTick(() => nameInputRef.value?.focus())
})

function onNew() {
  if (!confirm('清空当前资产内容？未保存的内容将丢失。')) return
  const cabinetId = editor.cabinetComponentId.value
  if (cabinetId) {
    void editor.createNewWithCabinet(cabinetId)
    return
  }
  editor.clearScene()
  editor.currentAssetId.value = null
  editor.currentAssetName.value = ''
}

async function onSaveClick() {
  if (editor.currentAssetId.value) {
    const record = await editor.saveAsset()
    if (record) showToast(`已覆盖保存：${record.name}`)
    return
  }
  showSaveDialog.value = true
}

async function onSave() {
  const name = assetName.value.trim()
  if (!name) return
  const record = await editor.saveAsset(name)
  if (!record) return

  showSaveDialog.value = false
  assetName.value = ''
  showToast(`已保存：${record.name}`)

  if (pendingReturn.value) {
    pendingReturn.value = false
    navigateBack()
  }
}

async function onSaveAndReturn() {
  if (editor.currentAssetId.value) {
    const record = await editor.saveAsset()
    if (!record) return
    showToast(`已保存：${record.name}`)
    setTimeout(() => navigateBack(), 300)
    return
  }
  pendingReturn.value = true
  showSaveDialog.value = true
}

function onBackClick() {
  if (editor.hasUnsavedChanges.value && !confirm('存在未保存的更改，确定离开吗？')) return
  navigateBack()
}

function navigateBack() {
  router.push(backRoute.value)
}

function showToast(message: string) {
  toastMsg.value = message
  setTimeout(() => {
    toastMsg.value = ''
  }, 2500)
}
</script>

<style scoped>
.editor-toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  z-index: 10;
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 18px;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.back-btn:hover {
  background: var(--color-primary-dim);
  color: var(--color-text);
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 4px;
}

.brand-icon {
  font-size: 20px;
  color: var(--color-primary);
}

.brand-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.3px;
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 6px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tool-btn:hover:not(:disabled) {
  background: var(--color-primary-dim);
  color: var(--color-text);
}

.tool-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.tool-btn.danger:not(:disabled):hover {
  background: rgba(255, 77, 106, 0.15);
  color: var(--color-danger);
}

.tool-label {
  font-size: 12px;
}

.asset-name-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.save-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.save-btn:hover {
  filter: brightness(1.15);
  box-shadow: 0 0 16px rgba(77, 163, 255, 0.35);
}

.return-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-md);
  color: #0c1021;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.return-btn:hover {
  filter: brightness(1.15);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  width: 380px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}

.modal-icon {
  font-size: 20px;
  color: var(--color-primary);
}

.modal-body {
  padding: 20px;
}

.field-label {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
}

.field-input:focus {
  border-color: var(--color-border-active);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
}

.btn-cancel,
.btn-confirm {
  padding: 7px 18px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  border: none;
}

.btn-cancel {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-confirm {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

.btn-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(45, 227, 162, 0.15);
  z-index: 1001;
}

.toast-icon {
  font-size: 18px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card {
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .modal-card {
  transform: scale(0.95) translateY(10px);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 300ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}
</style>
