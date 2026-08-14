<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { cloneEnvironment } from '@mh/3d-editor'
import type { EnvironmentJSON, FloorCoverage } from '@mh/3d-editor'
import {
  CEILING_PRESETS,
  FLOOR_PRESETS,
  WALL_PRESETS,
  resolveCeilingPreset,
  resolveFloorPreset,
  resolveWallPreset
} from '@mh/3d-editor-assets/common'

const props = defineProps<{
  environment: EnvironmentJSON | null
  bounds: { width: number; depth: number; height: number }
}>()

const emit = defineEmits<{
  'update:environment': [env: EnvironmentJSON]
  'update:bounds': []
}>()

const open = reactive({
  camera: true,
  light: true,
  helper: true,
  floor: true,
  wall: true,
  ceiling: true,
  room: true
})

const cameraForm = reactive({
  px: 0,
  py: 0,
  pz: 0,
  tx: 0,
  ty: 0,
  tz: 0
})

const uiOnly = reactive({
  ambientOn: true,
  mainOn: true,
  colorTemp: 4000,
  mainType: '矩形',
  showAxes: true,
  gradientType: '渐变',
  topColor: '#1e3a5f',
  bottomColor: '#0C1420',
  envMap: '工业室内'
})

const ambient = computed(() => props.environment?.lights?.find(l => l.type === 'ambient'))
const mainLight = computed(() => props.environment?.lights?.find(l => l.type === 'directional'))

const isSolidFloor = computed(() => {
  const f = props.environment?.floor
  return !f?.mapUrl && (f?.presetId ?? 'none') === 'none'
})
const isSolidCeiling = computed(() => {
  const c = props.environment?.ceiling
  return !c?.mapUrl && (c?.presetId ?? 'none') === 'none'
})
const isSolidWall = computed(() => {
  const w = props.environment?.wall
  return !w?.mapUrl && (w?.presetId ?? 'none') === 'none'
})

watch(
  () => props.environment,
  env => {
    const view = env?.defaultView
    if (!view) return
    cameraForm.px = Number(view.position[0].toFixed(2))
    cameraForm.py = Number(view.position[1].toFixed(2))
    cameraForm.pz = Number(view.position[2].toFixed(2))
    cameraForm.tx = Number(view.target[0].toFixed(2))
    cameraForm.ty = Number(view.target[1].toFixed(2))
    cameraForm.tz = Number(view.target[2].toFixed(2))
  },
  { immediate: true, deep: true }
)

function ensureEnv(): EnvironmentJSON | null {
  if (!props.environment) return null
  return cloneEnvironment(props.environment)
}

function patchAmbient(intensity: number) {
  const env = ensureEnv()
  if (!env) return
  const light = env.lights.find(l => l.type === 'ambient')
  if (light) light.intensity = intensity
  emit('update:environment', env)
}

function patchMain(intensity: number) {
  const env = ensureEnv()
  if (!env) return
  const light = env.lights.find(l => l.type === 'directional')
  if (light) light.intensity = intensity
  emit('update:environment', env)
}

function patchHelpers(key: 'grid' | 'enclosure', value: boolean) {
  const env = ensureEnv()
  if (!env) return
  if (key === 'grid') env.helpers.grid = value
  if (key === 'enclosure') env.helpers.enclosure = value ? 'openBox' : 'none'
  emit('update:environment', env)
}

function patchBackground(color: string) {
  const env = ensureEnv()
  if (!env) return
  env.background = { type: 'color', value: color }
  emit('update:environment', env)
}

function applyDefaultView() {
  const env = ensureEnv()
  if (!env) return
  env.defaultView = {
    ...(env.defaultView ?? {
      position: [7.5, 5.5, 8.5],
      target: [0, 0.9, 0],
      fov: 45
    }),
    position: [cameraForm.px, cameraForm.py, cameraForm.pz],
    target: [cameraForm.tx, cameraForm.ty, cameraForm.tz]
  }
  emit('update:environment', env)
}

function patchFloor(patch: {
  visible?: boolean
  coverage?: FloorCoverage
  color?: string
  presetId?: string
}) {
  const env = ensureEnv()
  if (!env) return
  if (patch.visible !== undefined) env.floor.visible = patch.visible
  if (patch.coverage !== undefined) env.floor.coverage = patch.coverage
  if (patch.color !== undefined) env.floor.color = patch.color
  if (patch.presetId !== undefined) {
    const preset = resolveFloorPreset(patch.presetId)
    env.floor.presetId = preset.id
    env.floor.mapUrl = preset.mapUrl
    if (preset.mapUrl) env.floor.color = '#ffffff'
    else if (env.floor.color === '#ffffff') env.floor.color = '#1a3048'
  }
  emit('update:environment', env)
}

function patchCeiling(patch: {
  visible?: boolean
  coverage?: FloorCoverage
  color?: string
  presetId?: string
}) {
  const env = ensureEnv()
  if (!env) return
  if (!env.ceiling) {
    env.ceiling = {
      visible: false,
      coverage: 'bounds',
      color: '#2a3544',
      opacity: 1,
      presetId: 'none'
    }
  }
  if (patch.visible !== undefined) env.ceiling.visible = patch.visible
  if (patch.coverage !== undefined) env.ceiling.coverage = patch.coverage
  if (patch.color !== undefined) env.ceiling.color = patch.color
  if (patch.presetId !== undefined) {
    const preset = resolveCeilingPreset(patch.presetId)
    env.ceiling.presetId = preset.id
    env.ceiling.mapUrl = preset.mapUrl
    if (preset.mapUrl) env.ceiling.color = '#ffffff'
    else if (env.ceiling.color === '#ffffff') env.ceiling.color = '#2a3544'
  }
  emit('update:environment', env)
}

function patchWall(patch: { color?: string; opacity?: number; presetId?: string }) {
  const env = ensureEnv()
  if (!env) return
  if (patch.color !== undefined) env.wall.color = patch.color
  if (patch.opacity !== undefined) env.wall.opacity = patch.opacity
  if (patch.presetId !== undefined) {
    const preset = resolveWallPreset(patch.presetId)
    env.wall.presetId = preset.id
    env.wall.mapUrl = preset.mapUrl
    if (preset.mapUrl) env.wall.color = '#ffffff'
    else if (env.wall.color === '#ffffff') env.wall.color = '#233242'
  }
  emit('update:environment', env)
}

function mm(m: number) {
  return Math.round(m * 1000)
}
</script>

<template>
  <div class="scene-panel">
    <section class="section">
      <button type="button" class="sec-head" @click="open.camera = !open.camera">
        <span class="caret">{{ open.camera ? '▾' : '▸' }}</span>
        相机
      </button>
      <div v-show="open.camera" class="sec-body">
        <div class="hint-line">透视 / 正交请用 3D 视口底栏切换</div>
        <div class="caption">位置</div>
        <div class="row3">
          <label class="field">
            <span>X</span>
            <input v-model.number="cameraForm.px" type="number" step="0.1" @change="applyDefaultView" />
          </label>
          <label class="field">
            <span>Y</span>
            <input v-model.number="cameraForm.py" type="number" step="0.1" @change="applyDefaultView" />
          </label>
          <label class="field">
            <span>Z</span>
            <input v-model.number="cameraForm.pz" type="number" step="0.1" @change="applyDefaultView" />
          </label>
        </div>
        <div class="caption">目标点</div>
        <div class="row3">
          <label class="field">
            <span>X</span>
            <input v-model.number="cameraForm.tx" type="number" step="0.1" @change="applyDefaultView" />
          </label>
          <label class="field">
            <span>Y</span>
            <input v-model.number="cameraForm.ty" type="number" step="0.1" @change="applyDefaultView" />
          </label>
          <label class="field">
            <span>Z</span>
            <input v-model.number="cameraForm.tz" type="number" step="0.1" @change="applyDefaultView" />
          </label>
        </div>
      </div>
    </section>

    <section v-if="environment" class="section">
      <button type="button" class="sec-head" @click="open.light = !open.light">
        <span class="caret">{{ open.light ? '▾' : '▸' }}</span>
        灯光
      </button>
      <div v-show="open.light" class="sec-body">
        <div class="toggle-row">
          <span>环境光</span>
          <input v-model="uiOnly.ambientOn" type="checkbox" class="switch" />
        </div>
        <label v-if="ambient" class="field">
          <span>强度</span>
          <div class="inline">
            <input
              :value="ambient.intensity"
              type="range"
              min="0"
              max="2"
              step="0.05"
              @input="patchAmbient(Number(($event.target as HTMLInputElement).value))"
            />
            <input
              class="num"
              :value="ambient.intensity.toFixed(2)"
              type="number"
              step="0.05"
              @change="patchAmbient(Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </label>
        <label class="field">
          <span>色温 (K) · UI</span>
          <input v-model.number="uiOnly.colorTemp" type="range" min="2700" max="6500" step="100" />
        </label>

        <div class="toggle-row">
          <span>主灯光</span>
          <input v-model="uiOnly.mainOn" type="checkbox" class="switch" />
        </div>
        <label v-if="mainLight" class="field">
          <span>强度</span>
          <div class="inline">
            <input
              :value="mainLight.intensity"
              type="range"
              min="0"
              max="3"
              step="0.05"
              @input="patchMain(Number(($event.target as HTMLInputElement).value))"
            />
            <input
              class="num"
              :value="mainLight.intensity.toFixed(2)"
              type="number"
              step="0.05"
              @change="patchMain(Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </label>
        <label class="field">
          <span>类型 · UI</span>
          <select v-model="uiOnly.mainType">
            <option>矩形</option>
            <option>平行光</option>
            <option>点光</option>
          </select>
        </label>
      </div>
    </section>

    <section v-if="environment" class="section">
      <button type="button" class="sec-head" @click="open.helper = !open.helper">
        <span class="caret">{{ open.helper ? '▾' : '▸' }}</span>
        辅助对象
      </button>
      <div v-show="open.helper" class="sec-body">
        <div class="toggle-row">
          <span>显示网格</span>
          <input
            type="checkbox"
            class="switch"
            :checked="environment.helpers.grid"
            @change="patchHelpers('grid', ($event.target as HTMLInputElement).checked)"
          />
        </div>
        <div class="toggle-row">
          <span>围合辅助体</span>
          <input
            type="checkbox"
            class="switch"
            :checked="environment.helpers.enclosure !== 'none'"
            @change="patchHelpers('enclosure', ($event.target as HTMLInputElement).checked)"
          />
        </div>
        <div class="toggle-row">
          <span>显示轴 · UI</span>
          <input v-model="uiOnly.showAxes" type="checkbox" class="switch" />
        </div>
        <label class="field">
          <span>类型 · UI</span>
          <select v-model="uiOnly.gradientType">
            <option>渐变</option>
            <option>无</option>
            <option>纯色</option>
          </select>
        </label>
        <div class="row2">
          <label class="field">
            <span>顶色</span>
            <input v-model="uiOnly.topColor" type="color" />
          </label>
          <label class="field">
            <span>底色</span>
            <input v-model="uiOnly.bottomColor" type="color" />
          </label>
        </div>
        <label class="field">
          <span>环境贴图 · UI</span>
          <select v-model="uiOnly.envMap">
            <option>工业室内</option>
            <option>仓库</option>
            <option>中性棚拍</option>
          </select>
        </label>
        <label class="field">
          <span>背景色</span>
          <input
            :value="environment.background.type === 'color' ? environment.background.value : '#0C1420'"
            type="color"
            @input="patchBackground(($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </section>

    <section v-if="environment" class="section">
      <button type="button" class="sec-head" @click="open.floor = !open.floor">
        <span class="caret">{{ open.floor ? '▾' : '▸' }}</span>
        地面
      </button>
      <div v-show="open.floor" class="sec-body">
        <div class="toggle-row">
          <span>显示地面</span>
          <input
            type="checkbox"
            class="switch"
            :checked="environment.floor.visible"
            @change="patchFloor({ visible: ($event.target as HTMLInputElement).checked })"
          />
        </div>
        <label class="field">
          <span>铺设范围</span>
          <select
            :value="environment.floor.coverage"
            @change="
              patchFloor({
                coverage: ($event.target as HTMLSelectElement).value as
                  | 'bounds'
                  | 'closedRooms'
              })
            "
          >
            <option value="bounds">工作区</option>
            <option value="closedRooms">仅封闭区域</option>
          </select>
        </label>
        <label class="field">
          <span>纹理</span>
          <select
            :value="environment.floor.presetId ?? 'none'"
            @change="patchFloor({ presetId: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="p in FLOOR_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </label>
        <label v-if="isSolidFloor" class="field">
          <span>颜色</span>
          <input
            :value="environment.floor.color"
            type="color"
            @input="patchFloor({ color: ($event.target as HTMLInputElement).value })"
          />
        </label>
      </div>
    </section>

    <section v-if="environment" class="section">
      <button type="button" class="sec-head" @click="open.wall = !open.wall">
        <span class="caret">{{ open.wall ? '▾' : '▸' }}</span>
        墙体
      </button>
      <div v-show="open.wall" class="sec-body">
        <label class="field">
          <span>纹理</span>
          <select
            :value="environment.wall.presetId ?? 'none'"
            @change="patchWall({ presetId: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="p in WALL_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </label>
        <label v-if="isSolidWall" class="field">
          <span>颜色</span>
          <input
            :value="environment.wall.color"
            type="color"
            @input="patchWall({ color: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label class="field">
          <span>透明度</span>
          <input
            :value="environment.wall.opacity ?? 0.92"
            type="range"
            min="0"
            max="1"
            step="0.05"
            @input="patchWall({ opacity: Number(($event.target as HTMLInputElement).value) })"
          />
        </label>
      </div>
    </section>

    <section v-if="environment" class="section">
      <button type="button" class="sec-head" @click="open.ceiling = !open.ceiling">
        <span class="caret">{{ open.ceiling ? '▾' : '▸' }}</span>
        天花
      </button>
      <div v-show="open.ceiling" class="sec-body">
        <div class="toggle-row">
          <span>显示天花</span>
          <input
            type="checkbox"
            class="switch"
            :checked="environment.ceiling?.visible ?? false"
            @change="
              patchCeiling({ visible: ($event.target as HTMLInputElement).checked })
            "
          />
        </div>
        <label class="field">
          <span>铺设范围</span>
          <select
            :value="environment.ceiling?.coverage ?? 'bounds'"
            @change="
              patchCeiling({
                coverage: ($event.target as HTMLSelectElement).value as
                  | 'bounds'
                  | 'closedRooms'
              })
            "
          >
            <option value="bounds">工作区</option>
            <option value="closedRooms">仅封闭区域</option>
          </select>
        </label>
        <label class="field">
          <span>纹理</span>
          <select
            :value="environment.ceiling?.presetId ?? 'none'"
            @change="patchCeiling({ presetId: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="p in CEILING_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </label>
        <label v-if="isSolidCeiling" class="field">
          <span>颜色</span>
          <input
            :value="environment.ceiling?.color ?? '#2a3544'"
            type="color"
            @input="patchCeiling({ color: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <p class="hint">
          高度跟随工作区 height（{{ bounds.height }} m）；改工作区净高会同步墙高与天花。
        </p>
      </div>
    </section>

    <section class="section">
      <button type="button" class="sec-head" @click="open.room = !open.room">
        <span class="caret">{{ open.room ? '▾' : '▸' }}</span>
        工作区
      </button>
      <div v-show="open.room" class="sec-body">
        <div class="row3">
          <label class="field">
            <span>长 mm</span>
            <input :value="mm(bounds.width)" disabled />
          </label>
          <label class="field">
            <span>宽 mm</span>
            <input :value="mm(bounds.depth)" disabled />
          </label>
          <label class="field">
            <span>高 mm</span>
            <input :value="mm(bounds.height)" disabled />
          </label>
        </div>
        <div class="row3">
          <label class="field">
            <span>长 m</span>
            <input v-model.number="bounds.width" type="number" step="0.5" min="1" @change="emit('update:bounds')" />
          </label>
          <label class="field">
            <span>宽 m</span>
            <input v-model.number="bounds.depth" type="number" step="0.5" min="1" @change="emit('update:bounds')" />
          </label>
          <label class="field">
            <span>高 m（墙/天花）</span>
            <input v-model.number="bounds.height" type="number" step="0.1" min="1" @change="emit('update:bounds')" />
          </label>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scene-panel {
  padding: 6px 10px 12px;
}

.section {
  border-bottom: 1px solid var(--border-subtle);
}

.sec-head {
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.caret {
  width: 12px;
  color: var(--text-muted);
}

.sec-body {
  padding: 0 0 8px;
}

.caption {
  font-size: 10px;
  color: var(--text-muted);
  margin: 4px 0 2px;
}

.hint-line {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.hint {
  font-size: 11px;
  color: var(--text-muted);
  margin: 4px 0 0;
  line-height: 1.4;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
  font-size: 10px;
  color: var(--text-muted);
}

.field input,
.field select {
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: 0 6px;
  font-size: 12px;
}

.field input[type='range'] {
  height: 22px;
  padding: 0;
  accent-color: var(--accent);
}

.field input[type='color'] {
  padding: 2px;
}

.inline {
  display: grid;
  grid-template-columns: 1fr 56px;
  gap: 6px;
  align-items: center;
}

.inline .num {
  height: 28px;
}

.row3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  font-size: 12px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.switch {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}
</style>
