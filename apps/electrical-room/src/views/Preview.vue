<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createEditor } from '@mh/3d-editor'
import type { EditorSession, NodeInteractionEvent } from '@mh/3d-editor'
import {
  collectUsedSourceIds,
  createCompositeDataSourceFromConfigs,
  TwinPlayer
} from '@mh/3d-editor-twin'
import type { TwinDocumentNode } from '@mh/3d-editor-twin'
import { useRoute, useRouter } from 'vue-router'
import { createPreviewCatalog } from '@/business/catalog'
import { loadCommBundle } from '@/business/comm-store'
import { toDataSourceConfigs } from '@/business/comm-to-configs'
import * as api from '@/business/api'
import {
  DEVICE_STATUS_META,
  isDeviceStatus,
  toVisualState,
  type DeviceStatus
} from '@/business/device-status'
import { createProceduralResolvers } from '@/models/registry'

interface AlarmLog {
  time: string
  path: string
  label: string
  status: DeviceStatus
  detail: string
}

const el3d = ref<HTMLElement>()
const logs = ref<AlarmLog[]>([])
const running = ref(true)
const lastInteraction = ref('')
const lastValues = ref('')
const sourceLabel = ref('')

let session: EditorSession | undefined
let player: TwinPlayer | undefined

const legendItems = (Object.keys(DEVICE_STATUS_META) as DeviceStatus[]).map(status => ({
  status,
  label: DEVICE_STATUS_META[status].label,
  color: DEVICE_STATUS_META[status].color
}))

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const id = route.params.id as string | undefined
  const catalog = await createPreviewCatalog()
  const rec = id ? await api.getDocument('scene', id) : undefined
  const list = id ? [] : await api.listScenes()
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
    },
    procedural: {
      resolvers: createProceduralResolvers()
    }
  })

  if (!session.viewport3d) return

  const resolveNested = async (node: TwinDocumentNode) => {
    const ref = (node as { catalogRef?: { id: string; version: string } }).catalogRef
    if (!ref?.id) return undefined
    const item = await catalog.get(ref.id, ref.version)
    return item?.document?.nodes
  }

  const usedIds = await collectUsedSourceIds(session.document, resolveNested)
  const bundle = await loadCommBundle()
  const configs =
    usedIds.length > 0 ? toDataSourceConfigs(bundle, { sourceIds: usedIds }) : []
  const source = createCompositeDataSourceFromConfigs(configs)
  sourceLabel.value =
    configs.length > 0
      ? `使用 ${configs.length} 个源`
      : usedIds.length > 0
        ? '绑定源未在清单中，未建连'
        : '无绑定，未建连'

  player = new TwinPlayer({
    document: session.document,
    viewport: session.viewport3d,
    source,
    resolveNested,
    mapHighlight: effect =>
      toVisualState(isDeviceStatus(effect) ? effect : 'fault'),
    getPaused: () => !running.value,
    onHighlight: ({ path, label, effect, twinId }) => {
      if (!effect || effect === 'normal' || !isDeviceStatus(effect)) return
      const values = player?.getStore().getAllForTwin(twinId) ?? {}
      const detail = Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
      lastValues.value = detail
      logs.value.unshift({
        time: new Date().toLocaleTimeString(),
        path,
        label,
        status: effect,
        detail
      })
      logs.value = logs.value.slice(0, 30)
    }
  })
  await player.start()
})

onBeforeUnmount(() => {
  player?.stop()
  player = undefined
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
