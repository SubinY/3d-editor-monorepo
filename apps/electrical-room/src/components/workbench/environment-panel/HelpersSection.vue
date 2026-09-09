<script setup lang="ts">
import { computed } from 'vue'
import { createDefaultWall } from '@mh/3d-editor'
import type { EnvironmentJSON, EnvironmentWallJSON } from '@mh/3d-editor'
import { WALL_PRESETS, resolveWallPreset } from '@mh/3d-editor-assets/common'

const props = defineProps<{
  form: EnvironmentJSON
  isScene?: boolean
  /** 会话态：3D 左下角性能 Info（不落库） */
  perfStatsVisible?: boolean
}>()

const emit = defineEmits<{
  commit: []
  'update:perfStatsVisible': [value: boolean]
}>()

function commit() {
  emit('commit')
}

function wall(): EnvironmentWallJSON {
  if (!props.form.wall) props.form.wall = createDefaultWall()
  return props.form.wall
}

const isSolidWall = computed(
  () => !wall().mapUrl && (wall().presetId ?? 'none') === 'none'
)

function setWallPreset(id: string) {
  const preset = resolveWallPreset(id)
  const w = wall()
  w.presetId = preset.id
  w.mapUrl = preset.mapUrl
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
    <el-form-item label="性能信息">
      <el-switch
        :model-value="perfStatsVisible ?? false"
        @update:model-value="emit('update:perfStatsVisible', $event)"
      />
    </el-form-item>
    <p class="hint">性能信息为会话开关，左下角显示物体 / 顶点 / 三角形 / 渲染时间（不落库）。</p>
    <el-form-item v-if="isScene === false" label="空间壳">
      <el-select v-model="form.helpers.enclosure" @change="commit">
        <el-option label="无" value="none" />
        <el-option label="开口盒" value="openBox" />
        <el-option label="单开门" value="openBoxDoor" />
        <el-option label="屏体" value="screenBody" />
      </el-select>
    </el-form-item>
    <p class="hint">网格用于编辑参照；柜体空间壳也可在属性面板切换。</p>

    <template v-if="isScene !== false">
      <div class="section-head">墙体默认</div>
      <p class="hint">
        地面 / 天花已改为按「工作区」多边形配置：用工具栏「画工作区」绘制，选中后在属性面板编辑。
      </p>
      <el-form-item label="默认高度(m)">
        <el-input-number
          :model-value="wall().defaultHeight ?? 2"
          :min="0.5"
          :max="20"
          :step="0.1"
          :precision="2"
          controls-position="right"
          @change="
            v => {
              wall().defaultHeight = Number(v)
              commit()
            }
          "
        />
      </el-form-item>
      <el-form-item label="默认厚度(m)">
        <el-input-number
          :model-value="wall().defaultThickness ?? 0.2"
          :min="0.05"
          :max="2"
          :step="0.05"
          :precision="2"
          controls-position="right"
          @change="
            v => {
              wall().defaultThickness = Number(v)
              commit()
            }
          "
        />
      </el-form-item>
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
            :model-value="wall().opacity ?? 1"
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
            :model-value="wall().opacity ?? 1"
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
      <el-form-item label="墙角相交">
        <el-switch
          :model-value="wall().cornerOverlap ?? false"
          @change="
            v => {
              wall().cornerOverlap = Boolean(v)
              commit()
            }
          "
        />
      </el-form-item>
      <p class="hint">
        新建墙段继承默认高/厚/材质；单墙可在属性面板覆盖。开启「墙角相交」后拐角更密实，半透明时可能闪烁。
      </p>
    </template>
  </el-form>
</template>
