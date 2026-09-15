<script setup lang="ts">
import { computed } from 'vue'
import type { DefaultViewJSON, EnvironmentJSON } from '@mh/3d-editor'
import type { LiveCameraPose } from './types'

const props = defineProps<{
  form: EnvironmentJSON
  liveCameraPose?: LiveCameraPose | null
}>()

const emit = defineEmits<{
  commit: []
  'enter-indoor': []
  'look-top': []
}>()

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
  if (!props.form.defaultView) {
    props.form.defaultView = {
      type: 'orbit',
      position: [5, 5, 5],
      target: [0, 0, 0],
      fov: 50,
      minDistance: 1,
      maxDistance: 500
    }
  }
  if (!props.form.defaultView.type) props.form.defaultView.type = 'orbit'
  return props.form.defaultView
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

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function roundVec3(v: readonly [number, number, number]): [number, number, number] {
  return [round3(v[0]), round3(v[1]), round3(v[2])]
}

const displayTarget = computed(() => roundVec3(props.liveCameraPose?.target ?? view.value.target))
const displayRadius = computed(() => round3(props.liveCameraPose?.radius ?? viewRadius(view.value)))

function commit() {
  emit('commit')
}

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
</script>

<template>
  <el-form label-position="left" label-width="108px" size="small">
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
          @input="v => { ensureView().fov = Math.round(Number(v) || 50) }"
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
    <el-form-item label="室内视角">
      <el-button type="primary" plain size="small" @click="emit('enter-indoor')">
        进入室内视角
      </el-button>
    </el-form-item>
    <el-form-item label="俯瞰">
      <el-button type="primary" plain size="small" @click="emit('look-top')">
        正上方俯瞰
      </el-button>
    </el-form-item>
    <p class="hint">
      透视/正交是投影模式；「进入室内视角」会把相机放到房间内（orbit）；「正上方俯瞰」走 look({ at: 'top' })，默认正交。
    </p>
    <p class="hint">
      目标=注视点；半径=眼睛到目标的距离（滚轮改的就是它）。视场角=镜头广角，与半径独立：广角变大画面更“撑开”，滚轮拉近又会把物体放大——两者可互相补偿，所以改完
      FOV 再滚轮，场景可能看起来又差不多。
    </p>
  </el-form>
</template>
