<template>
  <header class="scene-toolbar">
    <div class="toolbar-left">
      <router-link to="/asset-library" class="back-btn" title="返回资产库">
        <Icon icon="mdi:arrow-left" />
      </router-link>
      <div class="app-brand">
        <Icon icon="mdi:view-dashboard-outline" class="brand-icon" />
        <span class="brand-text">场景编辑器</span>
      </div>
      <div class="divider" />
      <button class="tool-btn" title="新建场景" @click="onNew">
        <Icon icon="mdi:file-plus-outline" />
      </button>
      <button class="tool-btn" title="撤销 (Ctrl+Z)" @click="editor.undo()">
        <Icon icon="mdi:undo" />
      </button>
      <button class="tool-btn" title="重做 (Ctrl+Y)" @click="editor.redo()">
        <Icon icon="mdi:redo" />
      </button>
      <div class="divider" />
      <button
        v-for="tool in transformTools"
        :key="tool.mode"
        class="tool-btn"
        :class="{ active: editor.currentTool.value === tool.mode }"
        :title="tool.title"
        @click="editor.setTool(tool.mode)"
      >
        <Icon :icon="tool.icon" />
        <span class="tool-label">{{ tool.label }}</span>
      </button>
      <div class="divider" />
      <button
        class="tool-btn danger"
        title="删除选中 (Delete)"
        :disabled="editor.selectedIds.value.length === 0"
        @click="editor.deleteSelection()"
      >
        <Icon icon="mdi:delete-outline" />
      </button>
    </div>

    <div class="toolbar-right">
      <button class="asset-btn" title="新建资产" @click="onNewAsset">
        <Icon icon="mdi:plus-box-outline" />
        <span>新建资产</span>
      </button>
      <button
        class="asset-btn edit"
        title="编辑选中实例的源资产"
        :disabled="!selectedAssetId"
        @click="onEditAsset"
      >
        <Icon icon="mdi:pencil-box-outline" />
        <span>编辑资产</span>
      </button>
      <div class="divider" />
      <span v-if="editor.sceneName.value" class="scene-name-badge">
        <Icon icon="mdi:tag-outline" />
        {{ editor.sceneName.value }}
      </span>
      <button class="save-btn" @click="showSaveDialog = true">
        <Icon icon="mdi:content-save-outline" />
        <span>保存场景</span>
      </button>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showSaveDialog" class="modal-overlay" @click.self="showSaveDialog = false">
        <div class="modal-card">
          <div class="modal-header">
            <Icon icon="mdi:content-save-check-outline" class="modal-icon" />
            <span>保存场景</span>
          </div>
          <div class="modal-body">
            <label class="field-label">场景名称</label>
            <input
              ref="saveInputRef"
              v-model="saveName"
              type="text"
              class="field-input"
              placeholder="例如：一层配电间-A区"
              @keydown.enter="onSave"
            />
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showSaveDialog = false">取消</button>
            <button class="btn-confirm" :disabled="!saveName.trim()" @click="onSave">
              <Icon icon="mdi:check" /> 保存
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
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useSceneEditor } from '../composables/useSceneEditor'
import type { TransformMode } from '../types'

const router = useRouter()
const editor = useSceneEditor()
const showSaveDialog = ref(false)
const saveName = ref('')
const saveInputRef = ref<HTMLInputElement>()
const toastMsg = ref('')

const selectedAssetId = computed(() => {
  const obj = editor.getSelectedObject()
  return obj?.userData?.assetId || null
})

const transformTools: { mode: TransformMode; label: string; title: string; icon: string }[] = [
  { mode: 'translate', label: '移动', title: '移动 (G/T)', icon: 'mdi:cursor-move' },
  { mode: 'rotate', label: '旋转', title: '旋转 (R)', icon: 'mdi:rotate-3d-variant' },
  { mode: 'scale', label: '缩放', title: '缩放 (S)', icon: 'mdi:arrow-expand-all' }
]

watch(showSaveDialog, val => {
  if (val) {
    saveName.value = editor.sceneName.value || ''
    nextTick(() => saveInputRef.value?.focus())
  }
})

function onNew() {
  if (confirm('清空当前场景？未保存内容将丢失。')) {
    editor.clearScene()
    editor.currentSceneId.value = null
    editor.sceneName.value = ''
  }
}

function onSave() {
  const name = saveName.value.trim()
  if (!name) return
  const record = editor.saveScene(name)
  if (record) {
    showSaveDialog.value = false
    saveName.value = ''
    showToast(`已保存：${record.name}`)
  }
}

function onNewAsset() {
  router.push({ path: '/asset-library', query: { tab: 'cabinet', createAsset: '1' } })
}

function onEditAsset() {
  if (!selectedAssetId.value) return
  const sceneId = editor.currentSceneId.value
  const query: Record<string, string> = { id: selectedAssetId.value, from: 'scene' }
  if (sceneId) query.sceneId = sceneId
  router.push({ path: '/asset-editor', query })
}

function showToast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => { toastMsg.value = '' }, 2500)
}
</script>

<style scoped>
.scene-toolbar {
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

.toolbar-left, .toolbar-right {
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
  margin: 0 4px;
}
.brand-icon { font-size: 20px; color: var(--color-accent); }
.brand-text { font-size: 14px; font-weight: 600; letter-spacing: 0.3px; }

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
.tool-btn:hover { background: var(--color-primary-dim); color: var(--color-text); }
.tool-btn.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.tool-btn.danger:not(:disabled):hover { background: rgba(255,77,106,.15); color: var(--color-danger); }
.tool-btn:disabled { opacity: .3; cursor: not-allowed; }
.tool-label { font-size: 12px; }

.asset-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.asset-btn:hover {
  background: var(--color-primary-dim);
  color: var(--color-text);
  border-color: var(--color-border-active);
}
.asset-btn.edit {
  color: var(--color-primary);
  border-color: rgba(77, 163, 255, 0.3);
}
.asset-btn.edit:hover {
  background: rgba(77, 163, 255, 0.1);
}
.asset-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.asset-btn :deep(.iconify) {
  font-size: 16px;
}

.scene-name-badge {
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
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: var(--color-accent);
  color: #0c1021;
  transition: all var(--transition-fast);
}
.save-btn:hover { filter: brightness(1.15); box-shadow: 0 0 16px rgba(45,227,162,.3); }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
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
  display: flex; align-items: center; gap: 8px;
  padding: 16px 20px; font-size: 15px; font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}
.modal-icon { font-size: 20px; color: var(--color-primary); }
.modal-body { padding: 20px; }
.field-label { display: block; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 6px; }
.field-input {
  width: 100%; padding: 9px 12px;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); color: var(--color-text); font-size: 14px; outline: none;
}
.field-input:focus { border-color: var(--color-border-active); }
.field-input::placeholder { color: var(--color-text-muted); }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px 16px; }
.btn-cancel, .btn-confirm {
  padding: 7px 18px; border-radius: var(--radius-sm); font-size: 13px; cursor: pointer; border: none;
  transition: all var(--transition-fast);
}
.btn-cancel { background: var(--color-surface); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
.btn-cancel:hover { color: var(--color-text); border-color: var(--color-text-muted); }
.btn-confirm {
  display: flex; align-items: center; gap: 4px;
  background: var(--color-primary); color: #fff; font-weight: 600;
}
.btn-confirm:hover:not(:disabled) { filter: brightness(1.1); }
.btn-confirm:disabled { opacity: .4; cursor: not-allowed; }

.toast {
  position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 10px 20px;
  background: var(--color-surface-elevated); border: 1px solid var(--color-accent);
  border-radius: var(--radius-md); color: var(--color-accent); font-size: 13px;
  font-weight: 500; box-shadow: 0 4px 20px rgba(45,227,162,.15); z-index: 1001;
}
.toast-icon { font-size: 18px; }

.modal-enter-active, .modal-leave-active { transition: opacity 200ms ease; }
.modal-enter-active .modal-card, .modal-leave-active .modal-card { transition: transform 200ms ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card { transform: scale(.95) translateY(10px); }
.modal-leave-to .modal-card { transform: scale(.95) translateY(10px); }
.toast-enter-active, .toast-leave-active { transition: all 300ms ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(16px); }
</style>
