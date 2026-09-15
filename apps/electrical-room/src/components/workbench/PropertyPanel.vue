<script setup lang="ts">
import { computed } from 'vue'
import { cloneEnvironment } from '@mh/3d-editor'
import type { EnvironmentJSON, WallJSON, WorkspaceJSON } from '@mh/3d-editor'
import { FLOOR_PRESETS, resolveFloorPreset } from '@mh/3d-editor-assets/common'
import { parseCabinetIdFromCatalogLabel } from '@/business/catalog'

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
  { value: 'openBoxDoor', label: '单开门' },
  { value: 'screenBody', label: '屏体' }
]

const props = defineProps<{
  isScene: boolean
  boundsForm: BoundsForm
  selectedNode: SelectedNodeForm
  selectedWall: WallJSON | null
  selectedWorkspace: WorkspaceJSON | null
  environment: EnvironmentJSON | null
  isPanel?: boolean
  /** 工作区边加点模式是否激活 */
  workspaceInsertVertexActive?: boolean
}>()

const emit = defineEmits<{
  'update:bounds': []
  'update:name': []
  'update:transform': []
  'update:enclosure': [env: EnvironmentJSON]
  'update:workspace': [
    patch: {
      name?: string
      height?: number
      floor?: Partial<WorkspaceJSON['floor']>
      ceiling?: Partial<WorkspaceJSON['ceiling']>
    }
  ]
  'edit-panel': []
  'edit-cabinet': []
  'toggle-insert-workspace-vertex': []
  remove: []
}>()

const isCabinet = computed(
  () => props.isScene && !!parseCabinetIdFromCatalogLabel(props.selectedNode.catalog)
)

const ws = computed(() => props.selectedWorkspace)

const isSolidFloor = computed(() => {
  const f = ws.value?.floor
  return !!f && !f.mapUrl && (f.presetId ?? 'none') === 'none'
})

const isSolidCeiling = computed(() => {
  const c = ws.value?.ceiling
  return !!c && !c.mapUrl && (c.presetId ?? 'none') === 'none'
})

function wallLength(wall: WallJSON): string {
  return Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]).toFixed(2)
}

function setEnclosure(kind: EnclosureKind) {
  if (!props.environment) return
  const env = cloneEnvironment(props.environment)
  env.helpers.enclosure = kind
  emit('update:enclosure', env)
}

function patchWorkspace(
  patch: {
    name?: string
    height?: number
    floor?: Partial<WorkspaceJSON['floor']>
    ceiling?: Partial<WorkspaceJSON['ceiling']>
  }
) {
  emit('update:workspace', patch)
}

function setFloorPreset(id: string) {
  const preset = resolveFloorPreset(id)
  patchWorkspace({
    floor: {
      presetId: preset.id,
      mapUrl: preset.mapUrl,
      color: preset.mapUrl ? '#ffffff' : ws.value?.floor.color ?? '#1a3048'
    }
  })
}

function setCeilingPreset(id: string) {
  const preset = resolveFloorPreset(id)
  patchWorkspace({
    ceiling: {
      presetId: preset.id,
      mapUrl: preset.mapUrl,
      color: preset.mapUrl ? '#ffffff' : ws.value?.ceiling.color ?? '#2a3544'
    }
  })
}
</script>

<template>
  <div class="property-panel">
    <section class="section">
      <div class="section-title">{{ isScene ? '场景包围盒' : '柜体尺寸' }}</div>
      <el-form label-position="top" size="small" class="bounds-form">
        <div class="row3">
          <el-form-item label="长 (X)">
            <el-input-number
              v-model="boundsForm.width"
              :min="isScene ? 1 : 0.01"
              :step="isScene ? 0.1 : 0.01"
              :precision="isScene ? 1 : 3"
              controls-position="right"
              @change="emit('update:bounds')"
            />
          </el-form-item>
          <el-form-item label="宽 (Z)">
            <el-input-number
              v-model="boundsForm.depth"
              :min="isScene ? 1 : 0.01"
              :step="isScene ? 0.1 : 0.01"
              :precision="isScene ? 1 : 3"
              controls-position="right"
              @change="emit('update:bounds')"
            />
          </el-form-item>
          <el-form-item :label="isScene ? '高 (参考)' : '高 (Y)'">
            <el-input-number
              v-model="boundsForm.height"
              :min="isScene ? 1 : 0.01"
              :step="isScene ? 0.1 : 0.01"
              :precision="isScene ? 1 : 3"
              controls-position="right"
              @change="emit('update:bounds')"
            />
          </el-form-item>
        </div>
      </el-form>
      <p v-if="isScene" class="hint">
        包围盒影响网格与适配；墙高看场景「墙体默认」，地面/天花看各工作区。
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
          v-if="isCabinet"
          type="primary"
          plain
          class="full"
          @click="emit('edit-cabinet')"
        >
          编辑柜体
        </el-button>
        <span></span>
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
          高 {{ selectedWall.height ?? environment?.wall?.defaultHeight ?? 2 }} m · 厚
          {{ selectedWall.thickness ?? environment?.wall?.defaultThickness ?? 0.2 }} m
        </div>
        <el-button type="danger" plain class="full" @click="emit('remove')">删除墙段</el-button>
      </template>

      <template v-else-if="ws">
        <el-form
          class="workspace-form"
          label-position="left"
          label-width="88px"
          size="small"
        >
          <div class="section-head">轮廓</div>
          <el-form-item label="名称">
            <el-input
              :model-value="ws.name ?? ''"
              @change="v => patchWorkspace({ name: String(v) })"
            />
          </el-form-item>
          <el-form-item label="天花高度(m)">
            <el-input-number
              :model-value="ws.height ?? boundsForm.height ?? 3"
              :min="0.5"
              :max="20"
              :step="0.1"
              :precision="2"
              controls-position="right"
              @change="v => patchWorkspace({ height: Number(v) })"
            />
          </el-form-item>
          <el-form-item label="轮廓顶点">
            <el-button
              class="full"
              :type="workspaceInsertVertexActive ? 'primary' : 'default'"
              @click="emit('toggle-insert-workspace-vertex')"
            >
              {{ workspaceInsertVertexActive ? '取消加点（Esc）' : '新增节点' }}
            </el-button>
          </el-form-item>

          <div class="section-head">地面</div>
          <el-form-item label="显示">
            <el-switch
              :model-value="ws.floor.visible"
              @change="v => patchWorkspace({ floor: { visible: Boolean(v) } })"
            />
          </el-form-item>
          <el-form-item label="纹理">
            <el-select
              :model-value="ws.floor.presetId ?? 'none'"
              :disabled="!ws.floor.visible"
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
              :model-value="ws.floor.color"
              :disabled="!ws.floor.visible"
              @change="v => patchWorkspace({ floor: { color: v || '#1a3048' } })"
            />
          </el-form-item>

          <div class="section-head">天花</div>
          <el-form-item label="显示">
            <el-switch
              :model-value="ws.ceiling.visible"
              @change="v => patchWorkspace({ ceiling: { visible: Boolean(v) } })"
            />
          </el-form-item>
          <el-form-item label="纹理">
            <el-select
              :model-value="ws.ceiling.presetId ?? 'none'"
              :disabled="!ws.ceiling.visible"
              @change="v => setCeilingPreset(String(v))"
            >
              <el-option
                v-for="preset in FLOOR_PRESETS"
                :key="preset.id"
                :label="preset.label"
                :value="preset.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isSolidCeiling" label="颜色">
            <el-color-picker
              :model-value="ws.ceiling.color"
              :disabled="!ws.ceiling.visible"
              @change="v => patchWorkspace({ ceiling: { color: v || '#2a3544' } })"
            />
          </el-form-item>
        </el-form>
        <el-button type="danger" plain class="full" @click="emit('remove')">删除工作区</el-button>
      </template>

      <p v-else class="hint">在 2D/3D 画布中点击对象查看属性；空白处点击取消选中。</p>
    </section>

    <section class="section">
      <div class="section-title">操作提示</div>
      <p v-if="isScene" class="hint">
        画墙：左键连续落点，右键或 Esc 结束链。<br />
        画工作区：≥3 点后右键/Esc/双击/点回起点闭合；地面与天花按工作区轮廓。<br />
        选中工作区可拖顶点改轮廓；「新增节点」后点高亮边插入顶点。<br />
        W 切换「选择 / 画墙」· Ctrl+Z / Ctrl+Shift+Z 撤销重做 · Delete 删除 · Esc
        结束工具态/清选中<br />
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.kv {
  font-size: 12px;
  color: #8ea4bd;
  margin-bottom: 8px;
}

.full {
  width: 100%;
  margin-top: 8px;
}

.hint {
  font-size: 12px;
  color: #4d6076;
  line-height: 1.6;
  margin: 8px 0 0;
}

.bounds-form :deep(.el-form-item) {
  margin-bottom: 8px;
}

.workspace-form .section-head {
  font-size: 13px;
  font-weight: 600;
  color: #e8f1fa;
  margin: 4px 0 12px;
}

.workspace-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.workspace-form :deep(.el-form-item__label) {
  color: #8ea4bd;
}

.workspace-form :deep(.el-input-number),
.workspace-form :deep(.el-select) {
  width: 100%;
}
</style>
