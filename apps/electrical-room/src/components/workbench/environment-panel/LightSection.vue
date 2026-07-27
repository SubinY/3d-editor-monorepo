<script setup lang="ts">
import type { EnvironmentJSON, LightJSON } from '@3d-editor/editor'

const props = defineProps<{
  form: EnvironmentJSON
}>()

const emit = defineEmits<{
  commit: []
}>()

function commit() {
  emit('commit')
}

function ensureAmbient(): LightJSON {
  let light = props.form.lights.find(l => l.type === 'ambient')
  if (!light) {
    light = { type: 'ambient', color: '#ffffff', intensity: 0.75 }
    props.form.lights.unshift(light)
  }
  return light
}

function ensureDirectional(): LightJSON {
  let light = props.form.lights.find(l => l.type === 'directional')
  if (!light) {
    light = {
      type: 'directional',
      color: '#ffffff',
      intensity: 1.4,
      position: [5, 10, 5],
      castShadow: true
    }
    props.form.lights.push(light)
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
</script>

<template>
  <el-form label-position="left" label-width="88px" size="small">
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
          @update:model-value="v => { ensureAmbient().intensity = Number(v) }"
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
          @update:model-value="v => { ensureDirectional().intensity = Number(v) }"
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
          :controls="false"
          controls-position="right"
          @change="
            v => {
              ensureDirectional().intensity = Number(v)
              commit()
            }
          "
        />
      </div>
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
</template>
