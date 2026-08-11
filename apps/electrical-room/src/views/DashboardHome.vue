<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createEditor, createPackCatalog, isDocumentItem } from '@mh/3d-editor'
import type { EditorDocument, EditorSession, NodeInteractionEvent } from '@mh/3d-editor'
import { getHomePublish } from '@/business/api'
import { readNodeBindings, type NodeBindingsProps } from '@/business/node-bindings'
import { fetchMockPointValues } from '@/business/mock-point-api'
import { PointValueStore, evaluateNodeRules } from '@/business/point-runtime'
import {
  DEVICE_STATUS_META,
  clearVisualState,
  toVisualState,
  type DeviceStatus
} from '@/business/device-status'
import { createProceduralResolver } from '@/models/registry'

interface Target {
  path: string
  label: string
  bindings: NodeBindingsProps
}

const router = useRouter()
const el3d = ref<HTMLElement>()
const ready = ref(false)
const empty = ref(false)
const sceneName = ref('')
const running = ref(true)

const envStats = ref([
  { label: '电气室温度', value: '26.4', unit: '°C' },
  { label: '电气室湿度', value: '52.8', unit: '%RH' },
  { label: '烟雾状态', value: '正常', unit: '' },
  { label: '门禁状态', value: '关闭', unit: '' },
  { label: 'UPS状态', value: '正常', unit: '' },
  { label: '在线柜数量', value: '—', unit: '台' },
  { label: '告警数量', value: '0', unit: '台' }
])

let session: EditorSession | undefined
let doc: EditorDocument | undefined
let timer = 0
let paintedPaths: string[] = []
const store = new PointValueStore()

const legendItems = (Object.keys(DEVICE_STATUS_META) as DeviceStatus[]).map(status => ({
  status,
  label: DEVICE_STATUS_META[status].label,
  color: DEVICE_STATUS_META[status].color
}))

async function collectTargets(): Promise<Target[]> {
  if (!doc) return []
  const catalog = doc.getCatalog()
  const targets: Target[] = []
  for (const node of doc.getNodes()) {
    const selfBindings = readNodeBindings(node)
    if (selfBindings.events.length > 0) {
      targets.push({ path: node.id, label: node.name ?? node.id, bindings: selfBindings })
    }
    if (!node.catalogRef || !catalog) continue
    const item = await catalog.get(node.catalogRef.id, node.catalogRef.version)
    if (!item || !isDocumentItem(item) || !item.document) continue
    for (const child of item.document.nodes) {
      const childBindings = readNodeBindings(child)
      if (childBindings.events.length === 0) continue
      targets.push({
        path: `${node.id}/${child.id}`,
        label: `${node.name ?? node.id} / ${child.name ?? child.id}`,
        bindings: childBindings
      })
    }
  }
  return targets
}

async function tick(targets: Target[]) {
  const viewport = session?.viewport3d
  if (!viewport || !running.value || targets.length === 0) return
  try {
    const values = await fetchMockPointValues()
    store.setMany(values)
  } catch {
    return
  }
  const values = store.getAll()
  paintedPaths.forEach(path => viewport.setNodeVisualState(path, clearVisualState()))
  paintedPaths = []
  let alarms = 0
  for (const target of targets) {
    const status = evaluateNodeRules(target.bindings, values) ?? 'normal'
    if (status === 'normal') continue
    alarms++
    viewport.setNodeVisualState(target.path, toVisualState(status))
    paintedPaths.push(target.path)
  }
  const alarmStat = envStats.value.find(s => s.label === '告警数量')
  if (alarmStat) alarmStat.value = String(alarms)
}

onMounted(async () => {
  const home = await getHomePublish()
  if (!home?.document || !home.assetPack) {
    empty.value = true
    ready.value = true
    return
  }
  sceneName.value = home.name ?? home.document.name
  const cabinetCount = home.document.nodes.length
  const online = envStats.value.find(s => s.label === '在线柜数量')
  if (online) online.value = String(cabinetCount)

  const catalog = createPackCatalog(home.assetPack)
  session = await createEditor({
    catalog,
    document: home.document,
    mount: { canvas3d: el3d.value },
    viewport3d: {
      readonly: true,
      hoverOutline: false,
      onInteraction: (_event: NodeInteractionEvent) => {
        /* click-through ok */
      }
    },
    procedural: {
      resolve: createProceduralResolver()
    }
  })
  doc = session.document
  ready.value = true
  const targets = await collectTargets()
  timer = window.setInterval(() => {
    void tick(targets)
  }, 2000)
  void tick(targets)
})

onBeforeUnmount(() => {
  window.clearInterval(timer)
  session?.dispose()
})
</script>

<template>
  <div class="dash">
    <header class="top">
      <div>
        <h1>电气室环境状态</h1>
        <p v-if="!empty">{{ sceneName }} · 发布包只读监控</p>
      </div>
      <el-button @click="router.push('/manage/rooms')">资产管理</el-button>
    </header>

    <div v-if="empty" class="empty">
      <h2>尚未配置监控首页</h2>
      <p>请先在电柜室管理中发布场景，再点击「首页显示」。</p>
      <el-button type="primary" @click="router.push('/manage/rooms')">前往电柜室管理</el-button>
    </div>

    <template v-else>
      <div class="stats">
        <div v-for="stat in envStats" :key="stat.label" class="stat">
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-value">
            {{ stat.value }}<span v-if="stat.unit" class="unit">{{ stat.unit }}</span>
          </div>
        </div>
      </div>

      <div class="stage-wrap">
        <div ref="el3d" class="stage" />
        <div v-if="!ready" class="loading">加载中…</div>
      </div>

      <footer class="legend-bar">
        <div class="legend">
          <span v-for="item in legendItems" :key="item.status">
            <i class="dot" :style="{ background: item.color }" />{{ item.label }}
          </span>
        </div>
        <div class="hint">拖拽旋转视角 · 滚轮缩放 · 点选柜体查看实时数据（mock）</div>
        <el-switch v-model="running" inline-prompt active-text="轮询" inactive-text="暂停" />
      </footer>
    </template>
  </div>
</template>

<style scoped>
.dash {
  height: 100%;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(1000px 480px at 50% 0%, rgba(31, 111, 235, 0.18), transparent 60%),
    #061018;
  color: #d7e6f5;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px 8px;
}
h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 1px;
}
.top p {
  margin: 4px 0 0;
  color: #6d8199;
  font-size: 12px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
  padding: 8px 24px 12px;
}
@media (max-width: 1100px) {
  .stats {
    grid-template-columns: repeat(4, 1fr);
  }
}
.stat {
  background: rgba(16, 32, 52, 0.72);
  border: 1px solid #1c3550;
  border-radius: 10px;
  padding: 10px 12px;
}
.stat-label {
  font-size: 11px;
  color: #7a93ab;
}
.stat-value {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 650;
  color: #3dd6ff;
}
.unit {
  font-size: 12px;
  margin-left: 4px;
  color: #8ea4bd;
  font-weight: 400;
}
.stage-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  margin: 0 16px;
  border: 1px solid #16304a;
  border-radius: 12px;
  overflow: hidden;
  background: #071320;
}
.stage {
  width: 100%;
  height: 100%;
}
.loading,
.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 10px;
  text-align: center;
  color: #8ea4bd;
}
.empty {
  position: relative;
  flex: 1;
}
.legend-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 24px 16px;
  flex-wrap: wrap;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  font-size: 12px;
  color: #8ea4bd;
}
.dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-right: 5px;
}
.hint {
  flex: 1;
  font-size: 12px;
  color: #4d6076;
}
</style>
