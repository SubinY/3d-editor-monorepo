<script setup lang="ts">
import { RefreshLeft, RefreshRight, Back } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { PROJECT_NAME, TOOLS, type EditorTool } from '../mock-data'

defineProps<{
  activeTool: EditorTool
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  'set-tool': [tool: EditorTool]
  undo: []
  redo: []
  preview: []
  publish: []
  'ai-layout': []
}>()

const router = useRouter()
</script>

<template>
  <header class="top">
    <div class="left">
      <button class="icon-btn" type="button" title="返回管理" @click="router.push('/manage/rooms')">
        <el-icon><Back /></el-icon>
      </button>
      <div class="logo">◇</div>
      <div class="proj">
        <span class="name">{{ PROJECT_NAME }}</span>
        <span class="chev">▾</span>
        <span class="badge">草稿</span>
      </div>
    </div>

    <div class="tools">
      <button
        v-for="t in TOOLS"
        :key="t.id"
        type="button"
        class="tool"
        :class="{ on: activeTool === t.id }"
        @click="emit('set-tool', t.id)"
      >
        {{ t.label }}
      </button>
    </div>

    <div class="right">
      <button class="icon-btn" type="button" :disabled="!canUndo" title="撤销" @click="emit('undo')">
        <el-icon><RefreshLeft /></el-icon>
      </button>
      <button class="icon-btn" type="button" :disabled="!canRedo" title="重做" @click="emit('redo')">
        <el-icon><RefreshRight /></el-icon>
      </button>
      <button class="ghost" type="button" @click="emit('ai-layout')">AI 布局</button>
      <button class="ghost" type="button" @click="emit('preview')">预览</button>
      <button class="primary" type="button" @click="emit('publish')">发布</button>
    </div>
  </header>
</template>

<style scoped>
.top {
  height: 52px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 14px;
  background: #0e1622;
  border-bottom: 1px solid #1c2a3d;
  gap: 12px;
}
.left,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.right {
  justify-content: flex-end;
}
.logo {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #3dd6ff, #1f6fff);
  color: #041018;
  font-weight: 700;
}
.proj {
  display: flex;
  align-items: center;
  gap: 6px;
}
.name {
  font-weight: 600;
  font-size: 14px;
}
.chev {
  color: #6d8199;
  font-size: 10px;
}
.badge {
  font-size: 11px;
  color: #9db0c5;
  background: #1a2738;
  border: 1px solid #2a3c52;
  border-radius: 999px;
  padding: 2px 8px;
}
.tools {
  display: flex;
  gap: 2px;
  background: #121c2a;
  border: 1px solid #223247;
  border-radius: 10px;
  padding: 3px;
}
.tool {
  border: 0;
  background: transparent;
  color: #8ea4bd;
  font-size: 12px;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.tool.on {
  background: #1f6fff;
  color: #fff;
}
.icon-btn,
.ghost,
.primary {
  border: 0;
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: #152033;
  color: #c5d4e6;
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.ghost {
  height: 32px;
  padding: 0 12px;
  background: #152033;
  color: #c5d4e6;
  border: 1px solid #2a3c52;
}
.primary {
  height: 32px;
  padding: 0 14px;
  background: #1f6fff;
  color: #fff;
  font-weight: 600;
}
</style>
