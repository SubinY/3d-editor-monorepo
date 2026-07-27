<script setup lang="ts">
import { computed } from 'vue'
import type {
  EnvironmentFloorJSON,
  EnvironmentJSON,
  EnvironmentWallJSON,
  FloorCoverage
} from '@3d-editor/editor'
import { FLOOR_PRESETS, resolveFloorPreset } from '@/business/floor-presets'
import { WALL_PRESETS, resolveWallPreset } from '@/business/wall-presets'

const props = defineProps<{
  form: EnvironmentJSON
  isScene?: boolean
}>()

const emit = defineEmits<{
  commit: []
}>()

function commit() {
  emit('commit')
}

function floor(): EnvironmentFloorJSON {
  return props.form.floor
}

function wall(): EnvironmentWallJSON {
  return props.form.wall
}

const isSolidFloor = computed(
  () => !floor().mapUrl && (floor().presetId ?? 'none') === 'none'
)

const isSolidWall = computed(
  () => !wall().mapUrl && (wall().presetId ?? 'none') === 'none'
)

function setFloorPreset(id: string) {
  const preset = resolveFloorPreset(id)
  const f = floor()
  f.presetId = preset.id
  f.mapUrl = preset.mapUrl
  if (preset.mapUrl) {
    f.color = '#ffffff'
  } else if (f.color === '#ffffff') {
    f.color = '#1a3048'
  }
  commit()
}

function setFloorCoverage(coverage: FloorCoverage) {
  floor().coverage = coverage
  commit()
}

function setWallPreset(id: string) {
  const preset = resolveWallPreset(id)
  const w = wall()
  w.presetId = preset.id
  w.mapUrl = preset.mapUrl
  // 有贴图时 color 会与 map 相乘；固定白色避免染色。纯色才用 color。
  if (preset.mapUrl) {
    w.color = '#ffffff'
  } else if (w.color === '#ffffff') {
    w.color = '#233242'
  }
  commit()
}
</script>

<template>
  <el-form label-position="left" label-width="88px" size="small">
    <div class="section-head">辅助体</div>
    <el-form-item label="网格">
      <el-switch v-model="form.helpers.grid" @change="commit" />
    </el-form-item>
    <p class="hint">网格用于编辑参照；空间壳仅在新建文档时写入。</p>

    <template v-if="isScene !== false">
      <div class="section-head">地面</div>
      <el-form-item label="显示">
        <el-switch v-model="floor().visible" @change="commit" />
      </el-form-item>
      <el-form-item label="铺设范围">
        <el-select
          :model-value="floor().coverage"
          :disabled="!floor().visible"
          @change="v => setFloorCoverage(v as FloorCoverage)"
        >
          <el-option label="工作区" value="bounds" />
          <el-option label="仅封闭区域" value="closedRooms" />
        </el-select>
      </el-form-item>
      <el-form-item label="纹理">
        <el-select
          :model-value="floor().presetId ?? 'none'"
          :disabled="!floor().visible"
          @change="v => setFloorPreset(String(v))"
        >
          <el-option
            v-for="preset in FLOOR_PRESETS"
            :key="preset.id"
            :label="preset.label"
            :value="preset.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="isSolidFloor" label="颜色">
        <el-color-picker
          :model-value="floor().color"
          :disabled="!floor().visible"
          @change="
            v => {
              floor().color = v || '#1a3048'
              commit()
            }
          "
        />
      </el-form-item>
      <el-form-item label="透明度">
        <div class="fov-row">
          <el-slider
            :model-value="floor().opacity ?? 1"
            :min="0"
            :max="1"
            :step="0.05"
            :disabled="!floor().visible"
            @update:model-value="v => { floor().opacity = Number(v) }"
            @change="
              v => {
                floor().opacity = Number(v)
                commit()
              }
            "
          />
          <el-input-number
            class="fov-input"
            :model-value="floor().opacity ?? 1"
            :min="0"
            :max="1"
            :step="0.05"
            :precision="2"
            :disabled="!floor().visible"
            controls-position="right"
            :controls="false"
            @change="
              v => {
                floor().opacity = Number(v)
                commit()
              }
            "
          />
        </div>
      </el-form-item>
      <p class="hint">
        「仅封闭区域」跟随闭合墙环；纹理来自应用内置静态资源，可局域网加载。
      </p>

      <div class="section-head">墙体</div>
      <el-form-item label="纹理">
        <el-select
          :model-value="wall().presetId ?? 'none'"
          @change="v => setWallPreset(String(v))"
        >
          <el-option
            v-for="preset in WALL_PRESETS"
            :key="preset.id"
            :label="preset.label"
            :value="preset.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="isSolidWall" label="颜色">
        <el-color-picker
          :model-value="wall().color"
          @change="
            v => {
              wall().color = v || '#233242'
              commit()
            }
          "
        />
      </el-form-item>
      <el-form-item label="透明度">
        <div class="fov-row">
          <el-slider
            :model-value="wall().opacity ?? 0.92"
            :min="0"
            :max="1"
            :step="0.05"
            @update:model-value="v => { wall().opacity = Number(v) }"
            @change="
              v => {
                wall().opacity = Number(v)
                commit()
              }
            "
          />
          <el-input-number
            class="fov-input"
            :model-value="wall().opacity ?? 0.92"
            :min="0"
            :max="1"
            :step="0.05"
            :precision="2"
            controls-position="right"
            :controls="false"
            @change="
              v => {
                wall().opacity = Number(v)
                commit()
              }
            "
          />
        </div>
      </el-form-item>
      <p class="hint">所有墙共用一套材质；纹理来自应用内置静态资源，可局域网加载。</p>
    </template>
  </el-form>
</template>
