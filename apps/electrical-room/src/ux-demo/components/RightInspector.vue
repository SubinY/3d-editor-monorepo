<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EditorNodeJSON } from '@3d-editor/editor'
import type { RightTab } from '../mock-data'
import { POINT_LIBRARY } from '../mock-data'

const props = defineProps<{
  node: EditorNodeJSON | null
  tab: RightTab
  catalogLabel?: string
}>()

const emit = defineEmits<{
  'update:tab': [tab: RightTab]
  'update-name': [name: string]
  'update-transform': [patch: { x?: number; y?: number; z?: number; yawDeg?: number }]
  'update-props': [props: Record<string, unknown>]
  interior: []
}>()

const newWhen = ref('temp > 45')
const newThen = ref('高亮红色')
const newName = ref('新规则')

const bindings = computed(() => {
  const raw = (props.node?.props as { bindings?: Array<{ key: string; alias?: string }> } | undefined)?.bindings
  return raw ?? []
})

const events = computed(() => {
  const raw = (props.node?.props as { events?: Array<{ id: string; name: string; when: string; then: string }> } | undefined)
    ?.events
  return raw ?? []
})

const boundKeys = computed(() => new Set(bindings.value.map(b => b.key)))

function yawDeg(node: EditorNodeJSON): number {
  return Math.round(((node.transform.rotation[1] * 180) / Math.PI) * 10) / 10
}

function toggleBinding(key: string, label: string) {
  if (!props.node) return
  const next = [...bindings.value]
  const idx = next.findIndex(b => b.key === key)
  if (idx >= 0) next.splice(idx, 1)
  else next.push({ key, alias: label })
  emit('update-props', { ...(props.node.props ?? {}), bindings: next })
}

function addEvent() {
  if (!props.node) return
  const next = [
    ...events.value,
    { id: `ev-${Date.now()}`, name: newName.value, when: newWhen.value, then: newThen.value }
  ]
  emit('update-props', { ...(props.node.props ?? {}), events: next })
  newName.value = '新规则'
}

function removeEvent(id: string) {
  if (!props.node) return
  emit('update-props', {
    ...(props.node.props ?? {}),
    events: events.value.filter(e => e.id !== id)
  })
}
</script>

<template>
  <aside class="right">
    <template v-if="node">
      <div class="head">
        <div>
          <h2>{{ node.name || '未命名' }}</h2>
          <div class="sub">
            <i class="online" />
            在线
            <span class="id">编号：{{ node.id }}</span>
          </div>
        </div>
        <button type="button" class="link" @click="emit('interior')">打开柜内</button>
      </div>

      <div class="tabs">
        <button
          v-for="t in [
            ['properties', '属性'],
            ['transform', '变换'],
            ['bindings', '点位'],
            ['events', '事件']
          ] as const"
          :key="t[0]"
          type="button"
          :class="{ on: tab === t[0] }"
          @click="emit('update:tab', t[0])"
        >
          {{ t[1] }}
        </button>
      </div>

      <div v-show="tab === 'properties'" class="body">
        <label>
          名称
          <input :value="node.name" @change="emit('update-name', ($event.target as HTMLInputElement).value)" />
        </label>
        <label>
          资产
          <div class="row">
            <input :value="catalogLabel || node.catalogRef?.id || '—'" readonly />
            <span class="tag">{{ node.catalogRef?.version || 'v1' }}</span>
          </div>
        </label>
        <div class="grid3">
          <label>
            X 米
            <input
              type="number"
              step="0.1"
              :value="node.transform.position[0]"
              @change="emit('update-transform', { x: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
          <label>
            Y 米
            <input
              type="number"
              step="0.1"
              :value="node.transform.position[1]"
              @change="emit('update-transform', { y: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
          <label>
            Z 米
            <input
              type="number"
              step="0.1"
              :value="node.transform.position[2]"
              @change="emit('update-transform', { z: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
        </div>
      </div>

      <div v-show="tab === 'transform'" class="body">
        <div class="grid3">
          <label>
            X
            <input
              type="number"
              step="0.1"
              :value="node.transform.position[0]"
              @change="emit('update-transform', { x: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
          <label>
            Y
            <input
              type="number"
              step="0.1"
              :value="node.transform.position[1]"
              @change="emit('update-transform', { y: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
          <label>
            Z
            <input
              type="number"
              step="0.1"
              :value="node.transform.position[2]"
              @change="emit('update-transform', { z: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
        </div>
        <label>
          偏航角 °
          <input
            type="number"
            :value="yawDeg(node)"
            @change="emit('update-transform', { yawDeg: Number(($event.target as HTMLInputElement).value) })"
          />
        </label>
      </div>

      <div v-show="tab === 'bindings'" class="body">
        <p class="hint">从点位库勾选绑定（写入 node.props，示意）。</p>
        <div v-for="p in POINT_LIBRARY" :key="p.key" class="bind-row">
          <label class="check">
            <input type="checkbox" :checked="boundKeys.has(p.key)" @change="toggleBinding(p.key, p.label)" />
            {{ p.label }}
          </label>
          <span class="unit">{{ p.unit || '—' }}</span>
        </div>
      </div>

      <div v-show="tab === 'events'" class="body">
        <div v-for="ev in events" :key="ev.id" class="event">
          <div class="e-head">
            <strong>{{ ev.name }}</strong>
            <button type="button" @click="removeEvent(ev.id)">删</button>
          </div>
          <div class="e-body">当 {{ ev.when }} → {{ ev.then }}</div>
        </div>
        <div class="sec">新增规则</div>
        <label>名称<input v-model="newName" /></label>
        <label>条件<input v-model="newWhen" /></label>
        <label>动作<input v-model="newThen" /></label>
        <button type="button" class="primary" @click="addEvent">添加事件</button>
      </div>
    </template>
    <div v-else class="empty">选中场景中的设备以查看属性</div>
  </aside>
</template>

<style scoped>
.right {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid #1c2a3d;
  background: #0c1420;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 14px 8px;
}
.head h2 {
  margin: 0;
  font-size: 16px;
}
.sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  color: #8ea4bd;
}
.sub i.online {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
}
.id {
  color: #5d738c;
}
.link {
  border: 0;
  background: transparent;
  color: #3dd6ff;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.tabs {
  display: flex;
  gap: 2px;
  padding: 0 10px;
  border-bottom: 1px solid #1c2a3d;
}
.tabs button {
  flex: 1;
  border: 0;
  background: transparent;
  color: #6d8199;
  font-size: 11px;
  padding: 8px 4px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.tabs button.on {
  color: #e8f4ff;
  border-bottom-color: #1f6fff;
}
.body {
  flex: 1;
  overflow: auto;
  padding: 12px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #7b90a8;
}
input {
  background: #121c2a;
  border: 1px solid #223247;
  border-radius: 7px;
  color: #d7e4f2;
  padding: 7px 8px;
  font-size: 12px;
  outline: none;
}
.grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag {
  font-size: 10px;
  background: #1a2738;
  border-radius: 999px;
  padding: 2px 8px;
  color: #9db0c5;
}
.hint {
  margin: 0;
  font-size: 12px;
  color: #6d8199;
}
.sec {
  margin-top: 6px;
  font-size: 12px;
  color: #7b90a8;
}
.bind-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  color: #c5d4e6;
}
.unit {
  color: #5d738c;
  font-size: 11px;
}
.event {
  background: #121c2a;
  border: 1px solid #1e2e42;
  border-radius: 8px;
  padding: 8px;
}
.e-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.e-head button {
  border: 0;
  background: transparent;
  color: #f87171;
  cursor: pointer;
}
.e-body {
  margin-top: 4px;
  font-size: 11px;
  color: #8ea4bd;
}
.primary {
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  background: #1f6fff;
  color: #fff;
  font-size: 12px;
  padding: 8px 10px;
}
.empty {
  padding: 40px 20px;
  text-align: center;
  color: #5d738c;
  font-size: 13px;
}
</style>
