<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import RuntimeHeader from '@/components/runtime/RuntimeHeader.vue'
import MetricCard from '@/components/runtime/MetricCard.vue'
import DeviceList from '@/components/runtime/DeviceList.vue'
import AlarmList from '@/components/runtime/AlarmList.vue'
import FloatingDeviceCard from '@/components/runtime/FloatingDeviceCard.vue'
import { createHostEditor } from '@/editor/create-host-editor'
import { createDefaultSceneJSON } from '@/editor/create-host-editor'
import { useEditorStore } from '@/stores/editor'
import { useRuntimeStore } from '@/stores/runtime'
import { toVisualState, clearVisualState, isDeviceStatus } from '@/utils/visual-state-map'
import { cloneEnvironment } from '@mh/3d-editor'
import type { EditorSession } from '@mh/3d-editor'
import { createDataSource, TwinPlayer, readTwin, resolveTwinId } from '@mh/3d-editor-twin'

const editorStore = useEditorStore()
const runtime = useRuntimeStore()
const {
  devices,
  alarms,
  selectedNodeId,
  updatedAt,
  metrics,
  statusSummary,
  selectedDevice
} = storeToRefs(runtime)

const canvasHost = ref<HTMLElement>()
const showAlarms = ref(true)
let session: EditorSession | undefined
let player: TwinPlayer | undefined

const metricCards = computed(() => [
  {
    title: '总电压',
    value: `${metrics.value.voltage.toFixed(1)} V`,
    sub: '额定 380 V',
    color: '#22C55E',
    icon: 'mdi:flash'
  },
  {
    title: '总电流',
    value: `${metrics.value.current.toFixed(1)} A`,
    sub: '阈值 250 A',
    color: '#3B82F6',
    icon: 'mdi:current-ac'
  },
  {
    title: '平均温度',
    value: `${metrics.value.temperature.toFixed(1)} °C`,
    sub: '阈值 60 °C',
    color: '#F59E0B',
    icon: 'mdi:thermometer'
  },
  {
    title: '功率因数',
    value: metrics.value.powerFactor.toFixed(2),
    sub: '目标 ≥ 0.90',
    color: '#A78BFA',
    icon: 'mdi:sine-wave'
  }
])

function applySelectionHighlight() {
  const vp = session?.viewport3d
  if (!vp || !selectedNodeId.value) return
  const selected = devices.value.find(d => d.nodeId === selectedNodeId.value)
  if (selected?.status === 'normal') {
    vp.setNodeVisualState(selectedNodeId.value, { color: '#60A5FA', intensity: 0.9 })
  }
}

function waitFrames(n = 2) {
  return new Promise<void>(resolve => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(() => step(left - 1))
    }
    step(n)
  })
}

function fitRuntimeCamera() {
  window.dispatchEvent(new Event('resize'))
  const doc = session?.document
  if (!doc) return

  const env = cloneEnvironment(doc.environment)
  env.defaultView = {
    type: 'orbit',
    position: [7.5, 5.5, 8.5],
    target: [0, 0.9, 0],
    fov: 45,
    minDistance: 1,
    maxDistance: 80
  }
  env.background = { type: 'color', value: '#0C1420' }
  doc.commands.setEnvironment(env)

  const cabinets = devices.value
  if (!cabinets.length) return
  const first = cabinets[0]
  runtime.selectDevice(first.nodeId)
  doc.selection.set(first.nodeId)
  session?.viewport3d?.focusSelection({ padding: 4.2 })
}

onMounted(async () => {
  await nextTick()
  await waitFrames(2)

  let doc = editorStore.loadPersistedDocument()
  if (!doc) {
    doc = await createDefaultSceneJSON()
    editorStore.persistDocument(doc)
  }

  session = await createHostEditor({
    document: doc,
    canvas3d: canvasHost.value,
    readonly: true
  })

  if (!session.viewport3d) return

  player = new TwinPlayer({
    document: session.document,
    viewport: session.viewport3d,
    source: createDataSource({
      type: 'http',
      url: '/api/twin/points',
      method: 'POST',
      intervalMs: 2000
    }),
    mapHighlight: effect => {
      if (!isDeviceStatus(effect) || effect === 'normal') return clearVisualState()
      return toVisualState(effect)
    },
    onPaint: results => {
      const store = player?.getStore()
      runtime.applyPaint(
        results.map(r => {
          const nodeId = r.path.includes('/') ? r.path.split('/')[0] : r.path
          const node = session?.document.getNode(nodeId)
          const twin = node ? readTwin(node) : undefined
          const deviceCode =
            typeof node?.props?.deviceCode === 'string'
              ? node.props.deviceCode
              : twin?.id ?? resolveTwinId({ id: nodeId, props: node?.props })
          return {
            nodeId,
            name: r.label,
            twinId: r.twinId,
            effect: r.effect,
            values: store?.getAllForTwin(r.twinId) ?? {},
            deviceCode
          }
        })
      )
      applySelectionHighlight()
    }
  })
  await player.start()

  session.document.on('selection:changed', () => {
    const id = session?.document.selection.first()
    if (id) runtime.selectDevice(id)
  })

  await nextTick()
  await waitFrames(2)
  fitRuntimeCamera()
})

onBeforeUnmount(() => {
  player?.stop()
  player = undefined
  session?.viewport3d?.clearVisualStates()
  session?.dispose()
  session = undefined
})

watch(selectedNodeId, () => {
  applySelectionHighlight()
})

function onSelectDevice(nodeId: string) {
  runtime.selectDevice(nodeId)
  session?.document.selection.set(nodeId)
  session?.viewport3d?.focusSelection()
}

function onSelectAlarm(deviceCode: string) {
  const d = devices.value.find(x => x.code === deviceCode)
  if (d) onSelectDevice(d.nodeId)
}

function resetView() {
  fitRuntimeCamera()
}
</script>

<template>
  <div class="runtime-view">
    <RuntimeHeader
      @reset-view="resetView"
      @toggle-alarms="showAlarms = !showAlarms"
    />

    <div class="body">
      <aside class="left">
        <div class="section-title">实时指标</div>
        <div class="metrics">
          <MetricCard
            v-for="m in metricCards"
            :key="m.title"
            :title="m.title"
            :value="m.value"
            :sub="m.sub"
            :color="m.color"
            :icon="m.icon"
          >
            <template #icon>
              <Icon :icon="m.icon" :width="18" :height="18" />
            </template>
          </MetricCard>
        </div>
        <DeviceList
          :devices="devices"
          :selected-id="selectedNodeId"
          @select="onSelectDevice"
        />
      </aside>

      <main class="center">
        <div ref="canvasHost" class="canvas-host" />
        <FloatingDeviceCard :device="selectedDevice" :updated-at="updatedAt" />
      </main>

      <aside v-show="showAlarms" class="right">
        <AlarmList :alarms="alarms" @select="onSelectAlarm" />
        <div class="summary-card">
          <div>设备总数 {{ statusSummary.total }}</div>
          <div>报警 {{ statusSummary.alarm }} · 预警 {{ statusSummary.warning }}</div>
        </div>
      </aside>
    </div>

    <footer class="status">
      <div class="left-s">
        <span class="pulse" />
        TwinPlayer · HttpDataSource
      </div>
      <div>更新时间: {{ updatedAt }}</div>
      <div class="right-s">
        <span>视图: 三维</span>
        <Icon icon="mdi:eye-outline" :width="16" :height="16" />
        <Icon icon="mdi:cube-outline" :width="16" :height="16" />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.runtime-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.left,
.right {
  width: 300px;
  flex-shrink: 0;
  background: var(--bg-panel);
  border-color: var(--border-subtle);
  padding: 12px;
  overflow: auto;
}

.left {
  border-right: 1px solid var(--border-subtle);
}

.right {
  border-left: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.center {
  flex: 1;
  min-width: 0;
  position: relative;
  background: var(--scene-bg);
}

.canvas-host {
  width: 100%;
  height: 100%;
}

.canvas-host :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.summary-card {
  margin-top: auto;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.status {
  height: var(--statusbar-h);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 14px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
}

.left-s,
.right-s {
  display: flex;
  align-items: center;
  gap: 8px;
}

.right-s {
  justify-content: flex-end;
}

.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
  animation: pulse 1.6s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}
</style>
