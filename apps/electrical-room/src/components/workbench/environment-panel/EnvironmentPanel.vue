<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import { Box, Camera, PictureFilled, Sunny } from '@element-plus/icons-vue'
import { cloneEnvironment, createDefaultWall } from '@mh/3d-editor'
import type { EnvironmentJSON } from '@mh/3d-editor'
import BackgroundSection from './BackgroundSection.vue'
import CameraSection from './CameraSection.vue'
import HelpersSection from './HelpersSection.vue'
import LightSection from './LightSection.vue'
import type { EnvSectionId, LiveCameraPose } from './types'

export type { LiveCameraPose }

const props = defineProps<{
  environment: EnvironmentJSON
  viewMode: '2d' | '3d' | 'split'
  isScene?: boolean
  liveCameraPose?: LiveCameraPose | null
  perfStatsVisible?: boolean
}>()

const emit = defineEmits<{
  apply: [env: EnvironmentJSON]
  'update:perfStatsVisible': [value: boolean]
  'enter-indoor': []
}>()

const section = ref<EnvSectionId>('camera')
const applying = ref(false)
const form = reactive(cloneEnvironment(props.environment))
if (!form.wall) form.wall = createDefaultWall()

watch(
  () => props.environment,
  env => {
    if (applying.value) return
    syncForm(env)
  },
  { deep: true }
)

function syncForm(env: EnvironmentJSON) {
  const next = cloneEnvironment(env)
  form.background = next.background
  form.lights = next.lights
  form.shadows = next.shadows
  form.helpers = next.helpers
  form.wall = next.wall ?? createDefaultWall()
  form.defaultView = next.defaultView
}

function commit() {
  applying.value = true
  emit('apply', cloneEnvironment(form))
  void nextTick(() => {
    applying.value = false
  })
}

const navItems: Array<{ id: EnvSectionId; icon: typeof Camera; title: string }> = [
  { id: 'camera', icon: Camera, title: '相机' },
  { id: 'light', icon: Sunny, title: '灯光' },
  { id: 'helpers', icon: Box, title: '辅助体' },
  { id: 'background', icon: PictureFilled, title: '背景' }
]
</script>

<template>
  <div class="env-panel">
    <nav class="icon-rail" aria-label="场景分区">
      <button
        v-for="item in navItems"
        :key="item.id"
        type="button"
        class="rail-btn"
        :class="{ active: section === item.id }"
        :title="item.title"
        @click="section = item.id"
      >
        <el-icon :size="18"><component :is="item.icon" /></el-icon>
      </button>
    </nav>

    <div class="env-body">
      <p v-if="viewMode === '2d'" class="hint banner">当前为 2D 视图，场景设置主要影响 3D 预览。</p>

      <CameraSection
        v-show="section === 'camera'"
        :form="form"
        :live-camera-pose="liveCameraPose"
        @commit="commit"
        @enter-indoor="emit('enter-indoor')"
      />
      <LightSection v-show="section === 'light'" :form="form" @commit="commit" />
      <HelpersSection
        v-show="section === 'helpers'"
        :form="form"
        :is-scene="isScene"
        :perf-stats-visible="perfStatsVisible"
        @commit="commit"
        @update:perf-stats-visible="emit('update:perfStatsVisible', $event)"
      />
      <BackgroundSection v-show="section === 'background'" :form="form" @commit="commit" />
    </div>
  </div>
</template>

<style scoped>
.env-panel {
  display: flex;
  height: 100%;
  min-height: 0;
}

.icon-rail {
  width: 44px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  background: #0a1018;
  border-right: 1px solid #1d2c3e;
}

.rail-btn {
  position: relative;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6a7f96;
  cursor: pointer;
}

.rail-btn:hover {
  color: #cfe0f0;
  background: #152033;
}

.rail-btn.active {
  color: #3dd68c;
  background: rgba(61, 214, 140, 0.12);
}

.rail-btn.active::after {
  content: '';
  position: absolute;
  right: -5px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 1px;
  background: #3dd68c;
}

.env-body {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 12px 12px 16px;
}

.env-body :deep(.section-head) {
  font-size: 13px;
  font-weight: 600;
  color: #e8f1fa;
  margin: 4px 0 12px;
}

.env-body :deep(.hint) {
  font-size: 12px;
  color: #4d6076;
  line-height: 1.6;
  margin: 0 0 12px;
}

.banner {
  padding: 8px 10px;
  background: #121c28;
  border-radius: 6px;
  border: 1px solid #1d2c3e;
}

.env-body :deep(.axis-x .el-input__inner) {
  color: #f56c6c;
}

.env-body :deep(.axis-y .el-input__inner) {
  color: #67c23a;
}

.env-body :deep(.axis-z .el-input__inner) {
  color: #409eff;
}

.env-body :deep(.el-slider) {
  width: 100%;
  padding-right: 4px;
}

.env-body :deep(.fov-row) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.env-body :deep(.fov-row .fov-slider) {
  flex: 1 1 auto;
  min-width: 80px;
  margin: 0;
  padding-right: 0;
}

.env-body :deep(.fov-row .fov-input.el-input-number),
.env-body :deep(.fov-row .el-input-number) {
  width: 72px !important;
  flex: 0 0 72px;
}

.env-body :deep(.color-row) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.env-body :deep(.el-form-item) {
  margin-bottom: 12px;
}

.env-body :deep(.el-form-item__label) {
  color: #8ea4bd;
}

.env-body :deep(.el-input-number),
.env-body :deep(.el-select) {
  width: 100%;
}
</style>
