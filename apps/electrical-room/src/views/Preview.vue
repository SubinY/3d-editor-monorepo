<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createEditor, isDocumentItem } from '@3d-editor/editor'
import type { EditorDocument, EditorSession, NodeInteractionEvent } from '@3d-editor/editor'
import { useRoute, useRouter } from 'vue-router'
import { createPreviewCatalog } from '@/business/catalog'
import * as api from '@/business/api'
import { readNodeBindings, type NodeBindingsProps } from '@/business/node-bindings'
import { fetchMockPointValues } from '@/business/mock-point-api'
import { PointValueStore, evaluateNodeRules } from '@/business/point-runtime'
import {
  DEVICE_STATUS_META,
  clearVisualState,
  toVisualState,
  type DeviceStatus
} from '@/business/device-status'

interface AlarmLog {
  time: string
  path: string
  label: string
  status: DeviceStatus
  detail: string
}

interface Target {
  path: string
  label: string
  bindings: NodeBindingsProps
}

const el3d = ref<HTMLElement>()
const logs = ref<AlarmLog[]>([])
const running = ref(true)
const lastInteraction = ref('')
const lastValues = ref('')
const sourceLabel = ref('')

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
      targets.push({
        path: node.id,
        label: node.name ?? node.id,
        bindings: selfBindings
      })
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
    lastValues.value = `temp=${values.temp} alarm=${values.alarm}`
  } catch {
    return
  }

  const values = store.getAll()
  paintedPaths.forEach(path => viewport.setNodeVisualState(path, clearVisualState()))
  paintedPaths = []

  const now = new Date().toLocaleTimeString()
  for (const target of targets) {
    const status = evaluateNodeRules(target.bindings, values) ?? 'normal'
    if (status === 'normal') continue
    viewport.setNodeVisualState(target.path, toVisualState(status))
    paintedPaths.push(target.path)
    logs.value.unshift({
      time: now,
      path: target.path,
      label: target.label,
      status,
      detail: lastValues.value
    })
  }
  logs.value = logs.value.slice(0, 30)
}

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const id = route.params.id as string | undefined
  sourceLabel.value = '已保存草稿 + 活 Catalog'
  const catalog = await createPreviewCatalog()
  const rec = id ? await api.getDocument(id) : undefined
  const list = id ? [] : await api.listDocuments('scene')
  const json = rec?.json ?? list[0]?.json
  if (!json) {
    router.replace('/manage/rooms')
    return
  }
  session = await createEditor({
    catalog,
    document: json,
    mount: { canvas3d: el3d.value },
    viewport3d: {
      readonly: true,
      hoverOutline: false,
      onInteraction: (event: NodeInteractionEvent) => {
        lastInteraction.value = `${event.type} → ${event.nodePath}`
      }
    }
  })

  doc = session.document
  const targets = await collectTargets()
  timer = window.setInterval(() => {
    void tick(targets)
  }, 2000)
  void tick(targets)
})

onBeforeUnmount(() => {
  window.clearInterval(timer)
  session?.dispose()
  session = undefined
})

function toggle() {
  running.value = !running.value
}
</script>

<template>
  <div class="preview">
    <div ref="el3d" class="stage" />
    <aside class="panel">
      <h3>监控预览（只读）</h3>
      <p class="source">数据源：{{ sourceLabel }}</p>
      <button @click="router.push('/manage/rooms')">← 返回列表</button>
      <div class="legend">
        <span v-for="item in legendItems" :key="item.status">
          <i class="dot" :style="{ background: item.color }" />{{ item.label }}
        </span>
      </div>
      <button @click="toggle">{{ running ? '暂停点位轮询' : '恢复点位轮询' }}</button>
      <p v-if="lastValues" class="meta">最新点位：{{ lastValues }}</p>
      <p v-if="lastInteraction" class="clicked">交互：{{ lastInteraction }}</p>
      <div class="logs">
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="log"
          :style="{ borderLeftColor: DEVICE_STATUS_META[log.status].color }"
        >
          <span class="time">{{ log.time }}</span>
          <span class="label">{{ log.label }}</span>
          <div class="detail">{{ DEVICE_STATUS_META[log.status].label }} · {{ log.detail }}</div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  height: 100%;
}
.stage {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
}
.panel {
  width: 300px;
  padding: 14px;
  background: #101823;
  border-left: 1px solid #22303f;
  color: #d5e0ec;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h3 {
  margin: 0;
  font-size: 14px;
}
.source {
  margin: 0;
  font-size: 12px;
  color: #3dd6ff;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 12px;
  color: #8ea4bd;
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}
button {
  background: #1d2a3a;
  color: #cfe0f0;
  border: 1px solid #2c3e52;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
}
.clicked,
.meta {
  font-size: 12px;
  color: #39d2ff;
  word-break: break-all;
  margin: 0;
}
.meta {
  color: #8ea4bd;
}
.logs {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.log {
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 4px;
  background: #16212e;
  border-left: 3px solid #3fae8a;
}
.time {
  color: #6d8199;
  margin-right: 8px;
}
.detail {
  margin-top: 4px;
  color: #6d8199;
  font-size: 11px;
}
</style>
