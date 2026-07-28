<script setup lang="ts">
import {
  Back,
  Delete,
  FullScreen,
  RefreshLeft,
  RefreshRight,
  Upload
} from '@element-plus/icons-vue'
import type { TransformMode } from '@3d-editor/editor'
import type { EditorTool, ViewMode } from './types'

defineProps<{
  docName: string
  isScene: boolean
  tool: EditorTool
  viewMode: ViewMode
  snapEnabled: boolean
  collisionEnabled: boolean
  rulersEnabled: boolean
  transformMode: TransformMode
  canUndo: boolean
  canRedo: boolean
  editingVersion?: string
}>()

const emit = defineEmits<{
  'update:docName': [value: string]
  back: []
  'set-tool': [tool: EditorTool]
  undo: []
  redo: []
  remove: []
  'fit-view': []
  'toggle-snap': []
  'toggle-collision': []
  'toggle-rulers': []
  'set-transform-mode': [mode: TransformMode]
  'set-view-mode': [mode: ViewMode]
  save: []
  publish: []
}>()
</script>

<template>
  <header class="toolbar">
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
      <el-button :type="tool === 'select' ? 'primary' : 'default'" @click="emit('set-tool', 'select')">
        选择
      </el-button>
      <el-button
        v-if="isScene"
        :type="tool === 'wall' ? 'primary' : 'default'"
        @click="emit('set-tool', 'wall')"
      >
        画墙
      </el-button>
    </el-button-group>

    <el-button-group>
      <el-button :icon="RefreshLeft" :disabled="!canUndo" title="撤销" @click="emit('undo')" />
      <el-button :icon="RefreshRight" :disabled="!canRedo" title="重做" @click="emit('redo')" />
      <el-button :icon="Delete" title="删除选中 (Del)" @click="emit('remove')" />
      <el-button :icon="FullScreen" title="视图适配" @click="emit('fit-view')" />
    </el-button-group>

    <el-button-group>
      <el-button :type="snapEnabled ? 'primary' : 'default'" @click="emit('toggle-snap')">
        吸附
      </el-button>
      <el-button :type="collisionEnabled ? 'primary' : 'default'" @click="emit('toggle-collision')">
        碰撞
      </el-button>
      <el-button :type="rulersEnabled ? 'primary' : 'default'" @click="emit('toggle-rulers')">
        标尺
      </el-button>
    </el-button-group>

    <el-button-group>
      <el-button
        :type="transformMode === 'translate' ? 'primary' : 'default'"
        @click="emit('set-transform-mode', 'translate')"
      >
        移动
      </el-button>
      <el-button
        :type="transformMode === 'rotate' ? 'primary' : 'default'"
        @click="emit('set-transform-mode', 'rotate')"
      >
        旋转
      </el-button>
    </el-button-group>

    <div class="spacer" />

    <el-button-group>
      <el-button :type="viewMode === '2d' ? 'primary' : 'default'" @click="emit('set-view-mode', '2d')">
        2D
      </el-button>
      <el-button
        :type="viewMode === 'split' ? 'primary' : 'default'"
        @click="emit('set-view-mode', 'split')"
      >
        并排
      </el-button>
      <el-button :type="viewMode === '3d' ? 'primary' : 'default'" @click="emit('set-view-mode', '3d')">
        3D
      </el-button>
    </el-button-group>

    <el-button type="primary" @click="emit('save')">保存</el-button>
    <el-button v-if="isScene" type="success" :icon="Upload" @click="emit('publish')">发布</el-button>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #101823;
  border-bottom: 1px solid #1d2c3e;
  flex-shrink: 0;
}
.doc-name {
  width: 200px;
}
.spacer {
  flex: 1;
}
</style>
