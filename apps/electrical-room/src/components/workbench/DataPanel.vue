<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Connection, Lightning } from '@element-plus/icons-vue'
import type {
  BuiltinPointKey,
  ConditionOp,
  NodeBindingsProps,
  NodeEventRule,
  PointBinding
} from '@/business/node-bindings'
import {
  BUILTIN_POINT_KEYS,
  BUILTIN_POINT_LABELS,
  CONDITION_OP_LABELS,
  HIGHLIGHT_STATUS_OPTIONS,
  createConditionEvent,
  createPointBinding,
  pointDisplayName
} from '@/business/node-bindings'
import type { DeviceStatus } from '@/business/device-status'

const props = defineProps<{
  nodeId: string
  modelValue: NodeBindingsProps
}>()

const emit = defineEmits<{
  'update:modelValue': [value: NodeBindingsProps]
}>()

type DataSection = 'points' | 'events'
const section = ref<DataSection>('points')

const local = reactive<NodeBindingsProps>({
  bindings: [],
  events: []
})

watch(
  () => props.modelValue,
  value => {
    local.bindings = value.bindings.map(b => ({ ...b }))
    local.events = value.events.map(e => ({
      ...e,
      when: { ...e.when },
      then: { ...e.then }
    }))
  },
  { immediate: true, deep: true }
)

function commit() {
  emit('update:modelValue', {
    bindings: local.bindings.map(b => ({ ...b })),
    events: local.events.map(e => ({
      ...e,
      when: { ...e.when },
      then: { ...e.then }
    }))
  })
}

const usedKeys = computed(() => new Set(local.bindings.map(b => b.key)))
const availableKeys = computed(() =>
  BUILTIN_POINT_KEYS.filter(key => !usedKeys.value.has(key))
)

const pointDialogVisible = ref(false)
const pointForm = reactive({
  keys: [] as BuiltinPointKey[],
  alias: ''
})

function openAddPoints() {
  pointForm.keys = []
  pointForm.alias = ''
  pointDialogVisible.value = true
}

function confirmAddPoints() {
  if (pointForm.keys.length === 0) return
  const alias = pointForm.alias.trim()
  for (const key of pointForm.keys) {
    if (usedKeys.value.has(key)) continue
    local.bindings.push(
      createPointBinding(key, pointForm.keys.length === 1 && alias ? alias : undefined)
    )
  }
  pointDialogVisible.value = false
  commit()
}

function updateAlias(binding: PointBinding, alias: string) {
  binding.alias = alias.trim() || undefined
  commit()
}

function removeBinding(id: string) {
  local.bindings = local.bindings.filter(b => b.id !== id)
  local.events = local.events.filter(e => {
    const stillBound = local.bindings.some(b => b.key === e.when.pointKey)
    return stillBound || e.kind === 'script'
  })
  commit()
}

const eventDialogVisible = ref(false)
const editingEventId = ref<string | null>(null)
const eventForm = reactive({
  name: '',
  kind: 'condition' as NodeEventRule['kind'],
  pointKey: 'temp' as BuiltinPointKey,
  op: 'gt' as ConditionOp,
  value: 80 as number | string,
  highlight: 'fault' as DeviceStatus,
  enabled: true
})

const boundPointOptions = computed(() =>
  local.bindings.map(b => ({
    value: b.key,
    label: pointDisplayName(b)
  }))
)

function openAddEvent() {
  editingEventId.value = null
  eventForm.name = ''
  eventForm.kind = 'condition'
  eventForm.pointKey = (local.bindings[0]?.key ?? 'temp') as BuiltinPointKey
  eventForm.op = 'gt'
  eventForm.value = 80
  eventForm.highlight = 'fault'
  eventForm.enabled = true
  eventDialogVisible.value = true
}

function openEditEvent(rule: NodeEventRule) {
  editingEventId.value = rule.id
  eventForm.name = rule.name ?? ''
  eventForm.kind = rule.kind
  eventForm.pointKey = rule.when.pointKey
  eventForm.op = rule.when.op
  eventForm.value = rule.when.value as number | string
  eventForm.highlight = rule.then.highlight
  eventForm.enabled = rule.enabled !== false
  eventDialogVisible.value = true
}

function confirmEvent() {
  if (eventForm.kind === 'script') return
  if (!local.bindings.some(b => b.key === eventForm.pointKey)) return
  const payload = createConditionEvent({
    id: editingEventId.value ?? undefined,
    name: eventForm.name.trim() || undefined,
    when: {
      pointKey: eventForm.pointKey,
      op: eventForm.op,
      value: Number.isFinite(Number(eventForm.value))
        ? Number(eventForm.value)
        : eventForm.value
    },
    then: { highlight: eventForm.highlight },
    enabled: eventForm.enabled
  })
  if (editingEventId.value) {
    const index = local.events.findIndex(e => e.id === editingEventId.value)
    if (index >= 0) {
      payload.id = editingEventId.value
      local.events[index] = payload
    }
  } else {
    local.events.push(payload)
  }
  eventDialogVisible.value = false
  commit()
}

function removeEvent(id: string) {
  local.events = local.events.filter(e => e.id !== id)
  commit()
}

function toggleEvent(rule: NodeEventRule, enabled: boolean) {
  rule.enabled = enabled
  commit()
}

function ruleSummary(rule: NodeEventRule): string {
  if (rule.kind === 'script') return '高级脚本（未启用）'
  const label = BUILTIN_POINT_LABELS[rule.when.pointKey] ?? rule.when.pointKey
  const op = CONDITION_OP_LABELS[rule.when.op]
  const hl =
    HIGHLIGHT_STATUS_OPTIONS.find(o => o.value === rule.then.highlight)?.label ??
    rule.then.highlight
  return `${label} ${op} ${rule.when.value} → ${hl}`
}

const navItems = [
  { id: 'points' as const, icon: Connection, title: '点位' },
  { id: 'events' as const, icon: Lightning, title: '事件' }
]
</script>

<template>
  <div class="data-panel">
    <nav class="icon-rail" aria-label="数据分区">
      <button
        v-for="item in navItems"
        :key="item.id"
        type="button"
        class="rail-btn"
        :class="{ active: section === item.id }"
        :title="item.title"
        @click="section = item.id"
      >
        <el-icon :size="18"><component :is="item.icon" /></el-icon>
      </button>
    </nav>

    <div class="data-body">
      <template v-if="section === 'points'">
        <div class="section-head row">
          <span>点位绑定</span>
          <el-button
            size="small"
            type="primary"
            :disabled="availableKeys.length === 0"
            @click="openAddPoints"
          >
            新增
          </el-button>
        </div>
        <p class="hint">从内置 10 个属性 key 中绑定；可设别名，支持删除。</p>
        <div v-if="local.bindings.length === 0" class="empty">尚未绑定点位</div>
        <ul v-else class="list">
          <li v-for="binding in local.bindings" :key="binding.id" class="list-item">
            <div class="item-main">
              <div class="item-title">{{ BUILTIN_POINT_LABELS[binding.key] }}</div>
              <div class="item-sub">{{ binding.key }}</div>
              <el-input
                :model-value="binding.alias ?? ''"
                size="small"
                placeholder="别名（可选）"
                @change="(v: string) => updateAlias(binding, v)"
              />
            </div>
            <el-button type="danger" link size="small" @click="removeBinding(binding.id)">
              删除
            </el-button>
          </li>
        </ul>
      </template>

      <template v-else>
        <div class="section-head row">
          <span>事件规则</span>
          <el-button
            size="small"
            type="primary"
            :disabled="local.bindings.length === 0"
            @click="openAddEvent"
          >
            新增
          </el-button>
        </div>
        <p class="hint">条件满足后触发物体高亮类型；高级脚本暂为占位。</p>
        <div v-if="local.events.length === 0" class="empty">尚未配置事件</div>
        <ul v-else class="list">
          <li v-for="rule in local.events" :key="rule.id" class="list-item">
            <div class="item-main">
              <div class="item-title">{{ rule.name || '未命名规则' }}</div>
              <div class="item-sub">{{ ruleSummary(rule) }}</div>
              <div class="item-actions">
                <el-switch
                  :model-value="rule.enabled !== false"
                  size="small"
                  @change="(v: boolean) => toggleEvent(rule, v)"
                />
                <el-button link size="small" @click="openEditEvent(rule)">编辑</el-button>
                <el-button type="danger" link size="small" @click="removeEvent(rule.id)">
                  删除
                </el-button>
              </div>
            </div>
          </li>
        </ul>
      </template>
    </div>

    <el-dialog v-model="pointDialogVisible" title="新增点位" width="360px" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="选择点位">
          <el-select
            v-model="pointForm.keys"
            multiple
            filterable
            placeholder="未占用的内置 key"
            style="width: 100%"
          >
            <el-option
              v-for="key in availableKeys"
              :key="key"
              :label="`${BUILTIN_POINT_LABELS[key]} (${key})`"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="pointForm.keys.length === 1" label="别名">
          <el-input v-model="pointForm.alias" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pointDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="pointForm.keys.length === 0" @click="confirmAddPoints">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="eventDialogVisible"
      :title="editingEventId ? '编辑事件' : '新增事件'"
      width="400px"
      append-to-body
    >
      <el-form label-position="top" size="small">
        <el-form-item label="名称">
          <el-input v-model="eventForm.name" placeholder="可选" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="eventForm.kind">
            <el-radio value="condition">条件判断</el-radio>
            <el-radio value="script" disabled>高级代码（即将支持）</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="eventForm.kind === 'condition'">
          <el-form-item label="点位">
            <el-select v-model="eventForm.pointKey" style="width: 100%">
              <el-option
                v-for="opt in boundPointOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="条件">
            <div class="cond-row">
              <el-select v-model="eventForm.op" style="width: 88px">
                <el-option
                  v-for="(label, op) in CONDITION_OP_LABELS"
                  :key="op"
                  :label="label"
                  :value="op"
                />
              </el-select>
              <el-input v-model="eventForm.value" placeholder="阈值" />
            </div>
          </el-form-item>
          <el-form-item label="触发高亮">
            <el-select v-model="eventForm.highlight" style="width: 100%">
              <el-option
                v-for="opt in HIGHLIGHT_STATUS_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="eventForm.enabled" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="eventDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="eventForm.kind !== 'condition' || boundPointOptions.length === 0"
          @click="confirmEvent"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.data-panel {
  display: flex;
  height: 100%;
  min-height: 0;
}

.icon-rail {
  width: 44px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  background: #0a1018;
  border-right: 1px solid #1d2c3e;
}

.rail-btn {
  position: relative;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6a7f96;
  cursor: pointer;
}

.rail-btn:hover {
  color: #cfe0f0;
  background: #152033;
}

.rail-btn.active {
  color: #3dd68c;
  background: rgba(61, 214, 140, 0.12);
}

.rail-btn.active::after {
  content: '';
  position: absolute;
  right: -5px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 1px;
  background: #3dd68c;
}

.data-body {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 12px;
}

.section-head {
  font-size: 13px;
  font-weight: 600;
  color: #e8f1fa;
  margin: 4px 0 8px;
}

.section-head.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hint {
  font-size: 12px;
  color: #4d6076;
  line-height: 1.6;
  margin: 0 0 12px;
}

.empty {
  font-size: 12px;
  color: #5d7188;
  padding: 24px 0;
  text-align: center;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px;
  background: #121c28;
  border: 1px solid #1d2c3e;
  border-radius: 6px;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-title {
  font-size: 13px;
  color: #e8f1fa;
}

.item-sub {
  font-size: 11px;
  color: #6a7f96;
  word-break: break-all;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cond-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
</style>
