<script setup lang="ts">
import { Back, Bottom, FullScreen, RefreshLeft, RefreshRight } from '@element-plus/icons-vue'
import type { EditorTool } from './types'

defineProps<{
  docName: string
  isScene: boolean
  tool: EditorTool
  canUndo: boolean
  canRedo: boolean
  canSnap: boolean
  editingVersion?: string
}>()

const emit = defineEmits<{
  'update:docName': [value: string]
  back: []
  undo: []
  redo: []
  'fit-view': []
  'snap-surface': []
  'set-tool': [tool: EditorTool]
  save: []
}>()
</script>

<template>
  <header class="toolbar">
    <div class="left">
      <el-button :icon="Back" circle title="返回列表" @click="emit('back')" />

      <el-input
        :model-value="docName"
        class="doc-name"
        placeholder="文档名称"
        @update:model-value="emit('update:docName', $event)"
      />
      <el-tag size="small" type="info" effect="plain">{{ isScene ? '电柜室' : '电柜' }}</el-tag>
      <el-tag v-if="!isScene && editingVersion" size="small" effect="dark" type="warning">
        v{{ editingVersion }}
      </el-tag>

      <el-button-group>
        <el-button :icon="RefreshLeft" :disabled="!canUndo" title="撤销" @click="emit('undo')" />
        <el-button :icon="RefreshRight" :disabled="!canRedo" title="重做" @click="emit('redo')" />
        <el-button :icon="FullScreen" title="视图适配" @click="emit('fit-view')" />
        <el-button
          :icon="Bottom"
          :disabled="!canSnap"
          :title="isScene ? '贴地面' : '贴柜面'"
          @click="emit('snap-surface')"
        />
      </el-button-group>
    </div>

    <div v-if="isScene" class="center">
      <div class="tool-mode">
        <button
          type="button"
          :class="{ on: tool === 'select' }"
          @click="emit('set-tool', 'select')"
        >
          选择
        </button>
        <button type="button" :class="{ on: tool === 'wall' }" @click="emit('set-tool', 'wall')">
          画墙
        </button>
      </div>
    </div>
    <div v-else class="center" />

    <div class="right">
      <el-button type="primary" @click="emit('save')">保存</el-button>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #101823;
  border-bottom: 1px solid #1d2c3e;
  flex-shrink: 0;
}
.left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.center {
  display: flex;
  justify-content: center;
}
.right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.doc-name {
  width: 200px;
}
.tool-mode {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: rgba(12, 18, 28, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}
.tool-mode button {
  border: 0;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #9db0c5;
  background: transparent;
  cursor: pointer;
}
.tool-mode button:hover {
  color: #e8f4ff;
}
.tool-mode button.on {
  background: #1f6fff;
  color: #fff;
}
</style>
