<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Box, Camera, MostlyCloudy, PictureFilled, Sunny } from '@element-plus/icons-vue'
import { cloneEnvironment } from '@3d-editor/editor'
import type { DefaultViewJSON, EnvironmentJSON } from '@3d-editor/editor'

export type LiveCameraPose = {
  position: [number, number, number]
  target: [number, number, number]
  radius: number
}

const props = defineProps<{
  environment: EnvironmentJSON
  viewMode: '2d' | '3d' | 'split'
  /** 3D Orbit 实时位姿；有值时目标/半径优先显示它 */
  liveCameraPose?: LiveCameraPose | null
}>()

const emit = defineEmits<{
  apply: [env: EnvironmentJSON]
}>()

type SectionId = 'camera' | 'light' | 'helpers' | 'background' | 'shadow'

const section = ref<SectionId>('camera')
const applying = ref(false)

const form = reactive(cloneEnvironment(props.environment))

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
  form.defaultView = next.defaultView
}

function commit() {
  applying.value = true
  emit('apply', cloneEnvironment(form))
  void nextTick(() => {
    applying.value = false
  })
}

/** 改 fov / 距离限制前，把当前 Orbit 位姿吸入表单，避免写回旧种子位姿 */
function absorbLivePose() {
  if (!props.liveCameraPose) return
  const v = ensureView()
  v.position = roundVec3(props.liveCameraPose.position)
  v.target = roundVec3(props.liveCameraPose.target)
}

function normalizeViewType(type: DefaultViewJSON['type']): 'orbit' | 'orthographic' {
  return type === 'orthographic' ? 'orthographic' : 'orbit'
}

function ensureView(): DefaultViewJSON {
  if (!form.defaultView) {
    form.defaultView = {
      type: 'orbit',
      position: [5, 5, 5],
      target: [0, 0, 0],
      fov: 50,
      minDistance: 1,
      maxDistance: 500
    }
  }
  if (!form.defaultView.type) form.defaultView.type = 'orbit'
  return form.defaultView
}

const view = computed(() => ensureView())
const cameraType = computed(() => normalizeViewType(view.value.type))
const isOrtho = computed(() => cameraType.value === 'orthographic')

function viewRadius(v: DefaultViewJSON): number {
  const dx = v.position[0] - v.target[0]
  const dy = v.position[1] - v.target[1]
  const dz = v.position[2] - v.target[2]
  return Math.hypot(dx, dy, dz) || 1
}

/** 表单展示/回写统一三位小数，避免 Orbit 浮点噪声狂刷 */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function roundVec3(v: readonly [number, number, number]): [number, number, number] {
  return [round3(v[0]), round3(v[1]), round3(v[2])]
}

const displayTarget = computed(() => roundVec3(props.liveCameraPose?.target ?? view.value.target))
const displayRadius = computed(() => round3(props.liveCameraPose?.radius ?? viewRadius(view.value)))

function setCameraType(type: 'orbit' | 'orthographic') {
  absorbLivePose()
  const v = ensureView()
  const prev = normalizeViewType(v.type)
  v.type = type
  if (type === 'orthographic' && prev !== 'orthographic') {
    const r = displayRadius.value
    const t = displayTarget.value
    v.target = [...t]
    v.position = [t[0], t[1] + r, t[2]]
    if (v.minDistance == null) v.minDistance = 1
    if (v.maxDistance == null) v.maxDistance = 10000
  }
  if (type === 'orbit' && prev !== 'orbit') {
    if (v.minDistance == null) v.minDistance = 1
    if (v.maxDistance == null) v.maxDistance = 500
  }
  commit()
}

function setTarget(axis: 0 | 1 | 2, value: number | undefined) {
  const v = ensureView()
  const prevTarget = displayTarget.value
  const next = [...prevTarget] as [number, number, number]
  next[axis] = round3(Number(value) || 0)
  const p = props.liveCameraPose?.position ?? v.position
  const dx = p[0] - prevTarget[0]
  const dy = p[1] - prevTarget[1]
  const dz = p[2] - prevTarget[2]
  const len = Math.hypot(dx, dy, dz) || 1
  const s = displayRadius.value / len
  v.target = next
  v.position = roundVec3([next[0] + dx * s, next[1] + dy * s, next[2] + dz * s])
  commit()
}

function setRadius(value: number | undefined) {
  const v = ensureView()
  const radius = Math.max(round3(Number(value) || 1), 0.001)
  const t = displayTarget.value
  const p = props.liveCameraPose?.position ?? v.position
  const dx = p[0] - t[0]
  const dy = p[1] - t[1]
  const dz = p[2] - t[2]
  const len = Math.hypot(dx, dy, dz) || 1
  const s = radius / len
  v.target = [...t]
  v.position = roundVec3([t[0] + dx * s, t[1] + dy * s, t[2] + dz * s])
  commit()
}

function ensureAmbient() {
  let light = form.lights.find(l => l.type === 'ambient')
  if (!light) {
    light = { type: 'ambient', color: '#ffffff', intensity: 0.75 }
    form.lights.unshift(light)
  }
  return light
}

function ensureDirectional() {
  let light = form.lights.find(l => l.type === 'directional')
  if (!light) {
    light = {
      type: 'directional',
      color: '#ffffff',
      intensity: 1.4,
      position: [5, 10, 5],
      castShadow: true
    }
    form.lights.push(light)
  }
  if (!light.position) light.position = [5, 10, 5]
  return light
}

function setDirPos(axis: 0 | 1 | 2, value: number | undefined) {
  const d = ensureDirectional()
  const p = [...(d.position ?? [5, 10, 5])] as [number, number, number]
  p[axis] = Number(value) || 0
  d.position = p
  commit()
}

const navItems: Array<{ id: SectionId; icon: typeof Camera; title: string }> = [
  { id: 'camera', icon: Camera, title: '相机' },
  { id: 'light', icon: Sunny, title: '灯光' },
  { id: 'helpers', icon: Box, title: '辅助体' },
  { id: 'background', icon: PictureFilled, title: '背景' },
  { id: 'shadow', icon: MostlyCloudy, title: '阴影' }
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

      <!-- 相机：对齐组态「旋转 / 正交」——正交≈平面图（禁旋转） -->
      <el-form v-show="section === 'camera'" label-position="left" label-width="108px" size="small">
        <div class="section-head">相机</div>
        <el-form-item label="相机类型">
          <el-select
            :model-value="cameraType"
            @change="v => setCameraType(v as 'orbit' | 'orthographic')"
          >
            <el-option label="旋转相机" value="orbit" />
            <el-option label="正交相机" value="orthographic" />
          </el-select>
        </el-form-item>
        <el-form-item label="视场角">
          <div class="fov-row">
            <el-slider
              class="fov-slider"
              :model-value="Math.round(view.fov ?? 50)"
              :min="isOrtho ? 1 : 10"
              :max="isOrtho ? 200 : 120"
              :step="1"
              @input="
                v => {
                  ensureView().fov = Math.round(Number(v) || 50)
                }
              "
              @change="
                v => {
                  absorbLivePose()
                  ensureView().fov = Math.round(Number(v) || 50)
                  commit()
                }
              "
            />
            <el-input-number
              class="fov-input"
              :model-value="Math.round(view.fov ?? 50)"
              :min="isOrtho ? 1 : 10"
              :max="isOrtho ? 200 : 120"
              :step="1"
              :controls="false"
              @change="
                v => {
                  absorbLivePose()
                  ensureView().fov = Math.round(Number(v) || 50)
                  commit()
                }
              "
            />
          </div>
        </el-form-item>
        <el-form-item label="目标 X">
          <el-input-number
            class="axis-x"
            :model-value="displayTarget[0]"
            :step="0.1"
            :precision="3"
            controls-position="right"
            @change="v => setTarget(0, v)"
          />
        </el-form-item>
        <el-form-item label="目标 Y">
          <el-input-number
            class="axis-y"
            :model-value="displayTarget[1]"
            :step="0.1"
            :precision="3"
            controls-position="right"
            @change="v => setTarget(1, v)"
          />
        </el-form-item>
        <el-form-item label="目标 Z">
          <el-input-number
            class="axis-z"
            :model-value="displayTarget[2]"
            :step="0.1"
            :precision="3"
            controls-position="right"
            @change="v => setTarget(2, v)"
          />
        </el-form-item>
        <el-form-item label="半径">
          <el-input-number
            :model-value="displayRadius"
            :min="0.001"
            :step="0.1"
            :precision="3"
            controls-position="right"
            @change="v => setRadius(v)"
          />
        </el-form-item>
        <el-form-item label="最近距离">
          <el-input-number
            :model-value="view.minDistance ?? 1"
            :min="0"
            :step="0.1"
            :precision="3"
            controls-position="right"
            @change="
              v => {
                absorbLivePose()
                ensureView().minDistance = Number(v)
                commit()
              }
            "
          />
        </el-form-item>
        <el-form-item label="最远距离">
          <el-input-number
            :model-value="view.maxDistance ?? (isOrtho ? 10000 : 500)"
            :min="1"
            :step="10"
            :precision="3"
            controls-position="right"
            @change="
              v => {
                absorbLivePose()
                ensureView().maxDistance = Number(v) || 500
                commit()
              }
            "
          />
        </el-form-item>
        <p class="hint">
          目标=注视点；半径=眼睛到目标的距离（滚轮改的就是它）。视场角=镜头广角，与半径独立：广角变大画面更“撑开”，滚轮拉近又会把物体放大——两者可互相补偿，所以改完
          FOV 再滚轮，场景可能看起来又差不多。
        </p>
      </el-form>

      <!-- 灯光 -->
      <el-form v-show="section === 'light'" label-position="left" label-width="88px" size="small">
        <div class="section-head">环境光</div>
        <el-form-item label="颜色">
          <el-color-picker
            :model-value="ensureAmbient().color ?? '#ffffff'"
            @change="
              v => {
                ensureAmbient().color = v || '#ffffff'
                commit()
              }
            "
          />
        </el-form-item>
        <el-form-item label="强度">
          <div class="fov-row">
            <el-slider
              :model-value="ensureAmbient().intensity ?? 0.75"
              :min="0"
              :max="3"
              :step="0.05"
              @update:model-value="
                v => {
                  ensureAmbient().intensity = Number(v)
                }
              "
              @change="
                v => {
                  ensureAmbient().intensity = Number(v)
                  commit()
                }
              "
            />
            <el-input-number
              class="fov-input"
              :model-value="ensureAmbient().intensity ?? 0.75"
              :min="0"
              :max="3"
              :step="0.05"
              :precision="2"
              :controls="false"
              controls-position="right"
              @change="
                v => {
                  ensureAmbient().intensity = Number(v)
                  commit()
                }
              "
            />
          </div>
        </el-form-item>

        <div class="section-head">平行光</div>
        <el-form-item label="颜色">
          <el-color-picker
            :model-value="ensureDirectional().color ?? '#ffffff'"
            @change="
              v => {
                ensureDirectional().color = v || '#ffffff'
                commit()
              }
            "
          />
        </el-form-item>
        <el-form-item label="强度">
          <div class="fov-row">
            <el-slider
              :model-value="ensureDirectional().intensity ?? 1.4"
              :min="0"
              :max="5"
              :step="0.05"
              @update:model-value="
                v => {
                  ensureDirectional().intensity = Number(v)
                }
              "
              @change="
                v => {
                  ensureDirectional().intensity = Number(v)
                  commit()
                }
              "
            />
            <el-input-number
              class="fov-input"
              :model-value="ensureDirectional().intensity ?? 1.4"
              :min="0"
              :max="5"
              :step="0.05"
              :precision="2"
              controls-position="right"
              :controls="false"
              @change="
                v => {
                  ensureDirectional().intensity = Number(v)
                  commit()
                }
              "
            />
          </div>
        </el-form-item>
        <el-form-item label="投射阴影">
          <el-switch
            :model-value="ensureDirectional().castShadow ?? false"
            @change="
              v => {
                ensureDirectional().castShadow = Boolean(v)
                commit()
              }
            "
          />
        </el-form-item>
        <el-form-item label="位置 X">
          <el-input-number
            class="axis-x"
            :model-value="ensureDirectional().position![0]"
            :step="0.5"
            :precision="3"
            controls-position="right"
            @change="v => setDirPos(0, v)"
          />
        </el-form-item>
        <el-form-item label="位置 Y">
          <el-input-number
            class="axis-y"
            :model-value="ensureDirectional().position![1]"
            :step="0.5"
            :precision="3"
            controls-position="right"
            @change="v => setDirPos(1, v)"
          />
        </el-form-item>
        <el-form-item label="位置 Z">
          <el-input-number
            class="axis-z"
            :model-value="ensureDirectional().position![2]"
            :step="0.5"
            :precision="3"
            controls-position="right"
            @change="v => setDirPos(2, v)"
          />
        </el-form-item>
      </el-form>

      <!-- 辅助体：空间壳由创建文档时的 helpers.enclosure 决定，不在此改 -->
      <el-form v-show="section === 'helpers'" label-position="left" label-width="88px" size="small">
        <div class="section-head">辅助体</div>
        <el-form-item label="网格">
          <el-switch v-model="form.helpers.grid" @change="commit" />
        </el-form-item>
        <p class="hint">网格用于编辑参照；空间壳（柜体开口盒等）仅在新建文档时写入，不在此调整。</p>
      </el-form>

      <!-- 背景 -->
      <el-form
        v-show="section === 'background'"
        label-position="left"
        label-width="88px"
        size="small"
      >
        <div class="section-head">背景</div>
        <el-form-item label="类型">
          <el-select
            :model-value="form.background.type"
            @change="
              mode => {
                if (mode === 'color') form.background = { type: 'color', value: '#0c1420' }
                else form.background = { type: 'equirect', url: '' }
                commit()
              }
            "
          >
            <el-option label="纯色" value="color" />
            <el-option label="全景" value="equirect" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.background.type === 'color'" label="颜色">
          <div class="color-row">
            <el-color-picker
              :model-value="form.background.value"
              @change="
                v => {
                  form.background = { type: 'color', value: v || '#0c1420' }
                  commit()
                }
              "
            />
            <el-input
              :model-value="form.background.value"
              @change="
                v => {
                  form.background = { type: 'color', value: String(v || '#0c1420') }
                  commit()
                }
              "
            />
          </div>
        </el-form-item>
        <el-form-item v-else label="全景 URL">
          <el-input
            :model-value="form.background.url"
            placeholder="https://…/.hdr 或 .jpg"
            @change="
              v => {
                form.background = { type: 'equirect', url: String(v || '') }
                commit()
              }
            "
          />
        </el-form-item>
      </el-form>

      <!-- 阴影 -->
      <el-form v-show="section === 'shadow'" label-position="left" label-width="88px" size="small">
        <div class="section-head">阴影</div>
        <el-form-item label="启用">
          <el-switch v-model="form.shadows.enabled" @change="commit" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.shadows.type" :disabled="!form.shadows.enabled" @change="commit">
            <el-option label="PCF Soft" value="pcfsoft" />
            <el-option label="Basic" value="basic" />
          </el-select>
        </el-form-item>
      </el-form>
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

.section-head {
  font-size: 13px;
  font-weight: 600;
  color: #e8f1fa;
  margin: 4px 0 12px;
}

.hint {
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

.xyz {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
  width: 100%;
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

.fov-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.fov-row :deep(.fov-slider) {
  flex: 1 1 auto;
  min-width: 80px;
  margin: 0;
  padding-right: 0;
}

.fov-row :deep(.fov-input.el-input-number) {
  width: 72px !important;
  flex: 0 0 72px;
}

.color-row {
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

.env-body :deep(.fov-row .el-input-number) {
  width: 72px !important;
}
</style>
