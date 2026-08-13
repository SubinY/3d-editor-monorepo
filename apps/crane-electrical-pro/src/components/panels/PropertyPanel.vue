<script setup lang="ts">
import { reactive, ref } from 'vue'

export type SelectedForm = {
  id: string
  name: string
  typeLabel: string
  x: number
  y: number
  z: number
  yawDeg: number
  width: number
  depth: number
  height: number
  catalog: string
  ratedVoltage?: number | null
  ratedCurrent?: number | null
  status?: string | null
}

defineProps<{
  selected: SelectedForm
  isPanel?: boolean
}>()

const emit = defineEmits<{
  'update:name': []
  'update:transform': []
  'update:props': []
  'edit-panel': []
  remove: []
}>()

const open = reactive({
  base: true,
  size: true,
  transform: true,
  electrical: true,
  panel: true
})

function mm(m: number) {
  return Math.round(m * 1000)
}
</script>

<template>
  <div class="property-panel">
    <template v-if="selected.id">
      <section class="section">
        <button type="button" class="sec-head" @click="open.base = !open.base">
          <span class="caret">{{ open.base ? '▾' : '▸' }}</span>
          选定对象
        </button>
        <div v-show="open.base" class="sec-body">
          <div class="obj-title">{{ selected.name || '未命名' }}</div>
          <div class="obj-type">{{ selected.typeLabel || '设备' }}</div>
          <label class="field">
            <span>名称</span>
            <input v-model="selected.name" @change="emit('update:name')" />
          </label>
        </div>
      </section>

      <section class="section">
        <button type="button" class="sec-head" @click="open.size = !open.size">
          <span class="caret">{{ open.size ? '▾' : '▸' }}</span>
          尺寸
        </button>
        <div v-show="open.size" class="sec-body">
          <div class="row3">
            <label class="field">
              <span>宽 mm</span>
              <input :value="mm(selected.width)" disabled />
            </label>
            <label class="field">
              <span>深 mm</span>
              <input :value="mm(selected.depth)" disabled />
            </label>
            <label class="field">
              <span>高 mm</span>
              <input :value="mm(selected.height)" disabled />
            </label>
          </div>
        </div>
      </section>

      <section class="section">
        <button type="button" class="sec-head" @click="open.transform = !open.transform">
          <span class="caret">{{ open.transform ? '▾' : '▸' }}</span>
          变换
        </button>
        <div v-show="open.transform" class="sec-body">
          <div class="caption">位置 (m)</div>
          <div class="row3">
            <label class="field">
              <span>X</span>
              <input v-model.number="selected.x" type="number" step="0.1" @change="emit('update:transform')" />
            </label>
            <label class="field">
              <span>Y</span>
              <input v-model.number="selected.y" type="number" step="0.1" @change="emit('update:transform')" />
            </label>
            <label class="field">
              <span>Z</span>
              <input v-model.number="selected.z" type="number" step="0.1" @change="emit('update:transform')" />
            </label>
          </div>
          <div class="caption">旋转 (°)</div>
          <div class="row3">
            <label class="field">
              <span>X</span>
              <input value="0" disabled />
            </label>
            <label class="field">
              <span>Y</span>
              <input v-model.number="selected.yawDeg" type="number" step="1" @change="emit('update:transform')" />
            </label>
            <label class="field">
              <span>Z</span>
              <input value="0" disabled />
            </label>
          </div>
        </div>
      </section>

      <section v-if="isPanel" class="section">
        <button type="button" class="sec-head" @click="open.panel = !open.panel">
          <span class="caret">{{ open.panel ? '▾' : '▸' }}</span>
          信息面板
        </button>
        <div v-show="open.panel" class="sec-body">
          <button type="button" class="action" @click="emit('edit-panel')">编辑面板内容</button>
          <p class="hint">文字 / 图片烘焙为贴图，Sprite 始终朝向相机。</p>
        </div>
      </section>

      <section class="section">
        <button type="button" class="sec-head" @click="open.electrical = !open.electrical">
          <span class="caret">{{ open.electrical ? '▾' : '▸' }}</span>
          电气
        </button>
        <div v-show="open.electrical" class="sec-body">
          <label class="field">
            <span>额定电压 (V)</span>
            <input v-model.number="selected.ratedVoltage" type="number" @change="emit('update:props')" />
          </label>
          <label class="field">
            <span>额定电流 (A)</span>
            <input v-model.number="selected.ratedCurrent" type="number" @change="emit('update:props')" />
          </label>
          <label class="field">
            <span>状态</span>
            <select v-model="selected.status" @change="emit('update:props')">
              <option value="normal">normal</option>
              <option value="warning">warning</option>
              <option value="fault">fault</option>
              <option value="offline">offline</option>
            </select>
          </label>
        </div>
      </section>

      <button type="button" class="danger" @click="emit('remove')">删除选中</button>
    </template>
    <div v-else class="empty">未选中对象</div>
  </div>
</template>

<style scoped>
.property-panel {
  padding: 6px 10px 12px;
}

.section {
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 2px;
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
  color: var(--text-muted);
  width: 12px;
}

.sec-body {
  padding: 0 0 8px;
}

.obj-title {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.obj-type {
  font-size: 11px;
  color: var(--text-muted);
  margin: 2px 0 8px;
}

.caption {
  font-size: 10px;
  color: var(--text-muted);
  margin: 4px 0;
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

.field input:disabled {
  opacity: 0.55;
}

.row3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.danger {
  margin-top: 10px;
  width: 100%;
  height: 28px;
  border: 1px solid var(--danger);
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
  cursor: pointer;
  font-size: 12px;
}

.action {
  width: 100%;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.hint {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

.empty {
  padding: 28px 8px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
