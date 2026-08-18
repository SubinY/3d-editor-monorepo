<script setup lang="ts">
import { cloneEnvironment } from '@mh/3d-editor'
import type { EnvironmentJSON, WallJSON } from '@mh/3d-editor'

export interface SelectedNodeForm {
  id: string
  name: string
  x: number
  y: number
  z: number
  yawDeg: number
  catalog: string
}

export interface BoundsForm {
  width: number
  depth: number
  height: number
}

type EnclosureKind = string

const ENCLOSURE_OPTIONS: Array<{ value: EnclosureKind; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'openBox', label: '开口盒' },
  { value: 'openBoxDoor', label: '单开门' }
]

const props = defineProps<{
  isScene: boolean
  boundsForm: BoundsForm
  selectedNode: SelectedNodeForm
  selectedWall: WallJSON | null
  environment: EnvironmentJSON | null
  isPanel?: boolean
}>()

const emit = defineEmits<{
  'update:bounds': []
  'update:name': []
  'update:transform': []
  'update:enclosure': [env: EnvironmentJSON]
  'edit-panel': []
  remove: []
}>()

function wallLength(wall: WallJSON): string {
  return Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]).toFixed(2)
}

function setEnclosure(kind: EnclosureKind) {
  if (!props.environment) return
  const env = cloneEnvironment(props.environment)
  env.helpers.enclosure = kind
  emit('update:enclosure', env)
}
</script>

<template>
  <div class="property-panel">
    <section class="section">
      <div class="section-title">{{ isScene ? '工作区尺寸' : '柜体尺寸' }}</div>
      <el-form label-position="top" size="small" class="bounds-form">
        <div class="row3">
          <el-form-item label="长 (X)">
            <el-input-number
              v-model="boundsForm.width"
              :min="isScene ? 1 : 0.2"
              :step="0.1"
              controls-position="right"
              @change="emit('update:bounds')"
            />
          </el-form-item>
          <el-form-item label="宽 (Z)">
            <el-input-number
              v-model="boundsForm.depth"
              :min="isScene ? 1 : 0.2"
              :step="0.1"
              controls-position="right"
              @change="emit('update:bounds')"
            />
          </el-form-item>
          <el-form-item :label="isScene ? '高 (墙/天花)' : '高 (Y)'">
            <el-input-number
              v-model="boundsForm.height"
              :min="isScene ? 1 : 0.5"
              :step="0.1"
              controls-position="right"
              @change="emit('update:bounds')"
            />
          </el-form-item>
        </div>
      </el-form>
      <p v-if="isScene" class="hint">
        长宽影响底图与网格；净高同步墙高与天花高度。房间轮廓仍由画墙决定。
      </p>
    </section>

    <section v-if="!isScene" class="section">
      <div class="section-title">柜体外观</div>
      <el-form label-position="top" size="small">
        <el-form-item label="空间壳">
          <el-select
            :model-value="environment?.helpers.enclosure ?? 'openBox'"
            :disabled="!environment"
            @change="v => setEnclosure(String(v))"
          >
            <el-option
              v-for="opt in ENCLOSURE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <p class="hint">编辑态柜壳（不可选中）。</p>
    </section>

    <section class="section">
      <div class="section-title">选中对象</div>

      <template v-if="selectedNode.id">
        <el-form label-position="top" size="small">
          <el-form-item label="名称">
            <el-input v-model="selectedNode.name" @change="emit('update:name')" />
          </el-form-item>
          <div class="row3">
            <el-form-item label="X 宽 (m)">
              <el-input-number
                v-model="selectedNode.x"
                :step="0.1"
                controls-position="right"
                @change="emit('update:transform')"
              />
            </el-form-item>
            <el-form-item v-if="isScene" label="Z 深 (m)">
              <el-input-number
                v-model="selectedNode.z"
                :step="0.1"
                controls-position="right"
                @change="emit('update:transform')"
              />
            </el-form-item>
            <el-form-item v-else label="Y 高 (m)">
              <el-input-number
                v-model="selectedNode.y"
                :step="0.1"
                controls-position="right"
                @change="emit('update:transform')"
              />
            </el-form-item>
            <el-form-item label="朝向 (°)">
              <el-input-number
                v-model="selectedNode.yawDeg"
                :step="15"
                controls-position="right"
                @change="emit('update:transform')"
              />
            </el-form-item>
          </div>
        </el-form>
        <div class="kv">资产：{{ selectedNode.catalog }}</div>
        <el-button
          v-if="isPanel"
          type="primary"
          plain
          class="full"
          @click="emit('edit-panel')"
        >
          编辑面板内容
        </el-button>
        <span></span>
        <el-button type="danger" plain class="full" @click="emit('remove')">删除节点</el-button>
        <p v-if="isPanel" class="hint" style="margin-top: 8px">
          文字 / 图片烘焙为贴图；场景内为 Sprite，始终朝向相机。
        </p>
      </template>

      <template v-else-if="selectedWall">
        <div class="kv">墙段长度：{{ wallLength(selectedWall) }} m</div>
        <div class="kv">
          高 {{ selectedWall.height ?? 3 }} m · 厚 {{ selectedWall.thickness ?? 0.2 }} m
        </div>
        <el-button type="danger" plain class="full" @click="emit('remove')">删除墙段</el-button>
      </template>

      <p v-else class="hint">在 2D/3D 画布中点击对象查看属性；空白处点击取消选中。</p>
    </section>

    <section class="section">
      <div class="section-title">操作提示</div>
      <p v-if="isScene" class="hint">
        画墙：左键连续落点，右键或 Esc 结束当前链；封闭墙体会自动填充地板。<br />
        W 切换「选择 / 画墙」· Ctrl+Z / Ctrl+Shift+Z 撤销重做 · Delete 删除 · Esc
        取消工具态/清选中<br />
        门 / 窗 / 柱拖近墙体会自动贴墙；物件拖动时有对齐辅助线。<br />
        平移：中键或 Shift+左键；缩放：滚轮。选中后拖主体平移，拖外侧圆环旋转。
      </p>
      <p v-else class="hint">
        2D 为柜内立面（宽 × 高），从开门方向往里看。<br />
        拖元器件到立面布置；Y=0 为柜底。3D 为五面开口柜体。<br />
        选中后拖主体平移，拖外侧圆环手柄旋转；拖动时显示对齐辅助线。<br />
        Ctrl+Z / Ctrl+Shift+Z 撤销重做 · Delete 删除 · Esc 清选中
      </p>
    </section>
  </div>
</template>

<style scoped>
.property-panel {
  padding: 14px 12px;
}

.section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #16222f;
}

.section-title {
  font-size: 11px;
  letter-spacing: 1px;
  color: #5d7188;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.row3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.bounds-form :deep(.el-input-number),
.row2 :deep(.el-input-number),
.row3 :deep(.el-input-number) {
  width: 100%;
}

.property-panel :deep(.el-select) {
  width: 100%;
}

.kv {
  font-size: 12px;
  color: #8ea4bd;
  margin: 6px 0;
  word-break: break-all;
}

.hint {
  font-size: 12px;
  color: #4d6076;
  line-height: 1.7;
  margin: 0;
}

.full {
  width: 100%;
  margin-top: 8px;
}

.property-panel :deep(.el-form-item) {
  margin-bottom: 10px;
}

.property-panel :deep(.el-form-item__label) {
  color: #8ea4bd;
  margin-bottom: 2px !important;
}
</style>
