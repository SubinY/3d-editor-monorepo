<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createEditor, isDocumentItem } from '@3d-editor/editor'
import type { EditorDocument, EditorSession, VisualState } from '@3d-editor/editor'
import { useRoute, useRouter } from 'vue-router'
import { createPreviewCatalog } from '@/business/catalog'
import { getDocument, listDocuments } from '@/business/storage'
import { createDemoSceneJSON } from '@/business/demo-scene'

interface AlarmLog {
  time: string
  path: string
  label: string
  status: VisualState['status']
}

const el3d = ref<HTMLElement>()
const logs = ref<AlarmLog[]>([])
const running = ref(true)
const clicked = ref('')

let session: EditorSession | undefined
let doc: EditorDocument | undefined
let timer = 0
let activeFaults: string[] = []

interface Target {
  path: string
  label: string
}

async function collectTargets(): Promise<Target[]> {
  if (!doc) return []
  const catalog = doc.getCatalog()
  const targets: Target[] = []
  for (const node of doc.getNodes()) {
    if (!node.catalogRef || !catalog) continue
    const item = await catalog.get(node.catalogRef.id, node.catalogRef.version)
    if (!item || !isDocumentItem(item) || !item.document) continue
    for (const child of item.document.nodes) {
      targets.push({
        path: `${node.id}/${child.id}`,
        label: `${node.name ?? node.id} / ${child.name ?? child.id}`
      })
    }
  }
  return targets
}

function tick(targets: Target[]) {
  const viewport = session?.viewport3d
  if (!viewport || !running.value || targets.length === 0) return
  activeFaults.forEach(path => viewport.setNodeVisualState(path, { status: 'normal' }))
  activeFaults = []

  const count = 1 + Math.floor(Math.random() * 2)
  const picked = new Set<number>()
  for (let i = 0; i < count; i++) {
    picked.add(Math.floor(Math.random() * targets.length))
  }
  const now = new Date().toLocaleTimeString()
  Array.from(picked).forEach((index, order) => {
    const target = targets[index]
    const status: VisualState['status'] = order === 0 ? 'fault' : 'warning'
    viewport.setNodeVisualState(target.path, { status, intensity: 1 })
    activeFaults.push(target.path)
    logs.value.unshift({ time: now, path: target.path, label: target.label, status })
  })
  logs.value = logs.value.slice(0, 30)
}

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const catalog = createPreviewCatalog()
  const id = route.params.id as string | undefined
  const json = (id ? getDocument(id) : undefined) ?? listDocuments('scene')[0] ?? (await createDemoSceneJSON())

  session = await createEditor({
    catalog,
    document: json,
    mount: { canvas3d: el3d.value },
    viewport3d: {
      readonly: true,
      onNodeClick: path => {
        clicked.value = path
      }
    }
  })
  doc = session.document

  const targets = await collectTargets()
  timer = window.setInterval(() => tick(targets), 2500)
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
      <button @click="router.push('/')">← 返回列表</button>
      <div class="legend">
        <span><i class="dot fault" />故障</span>
        <span><i class="dot warning" />告警</span>
        <span><i class="dot normal" />正常</span>
      </div>
      <button @click="toggle">{{ running ? '暂停 mock 告警' : '恢复 mock 告警' }}</button>
      <p v-if="clicked" class="clicked">点击节点：{{ clicked }}</p>
      <div class="logs">
        <div v-for="(log, index) in logs" :key="index" class="log" :class="log.status">
          <span class="time">{{ log.time }}</span>
          <span class="label">{{ log.label }}</span>
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
.legend {
  display: flex;
  gap: 14px;
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
.dot.fault {
  background: #ff4d4f;
}
.dot.warning {
  background: #f5a623;
}
.dot.normal {
  background: #3fae8a;
}
button {
  background: #1d2a3a;
  color: #cfe0f0;
  border: 1px solid #2c3e52;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
}
.clicked {
  font-size: 12px;
  color: #39d2ff;
  word-break: break-all;
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
.log.fault {
  border-left-color: #ff4d4f;
}
.log.warning {
  border-left-color: #f5a623;
}
.time {
  color: #6d8199;
  margin-right: 8px;
}
</style>
