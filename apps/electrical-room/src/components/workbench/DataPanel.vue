<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Connection, Lightning } from '@element-plus/icons-vue'
import type { ConditionOp, TwinPoint, TwinProps, TwinRule } from '@mh/3d-editor-twin'
import { createTwinPoint, createTwinRule, emptyTwin } from '@mh/3d-editor-twin'
import { loadCommBundle } from '@/business/comm-store'
import {
  COMM_PROTOCOL_LABEL,
  COMM_PROTOCOLS,
  type CommProtocol,
  type CommSource
} from '@/business/comm-types'
import { CONDITION_OP_LABELS, pointLabel } from '@/business/point-dictionary'
import { DEVICE_STATUS_OPTIONS, HIGHLIGHT_ANIMATION_OPTIONS, isHighlightAnimation, type DeviceStatus, type HighlightAnimation } from '@/business/device-status'

const props = defineProps<{
  nodeId: string
  modelValue: TwinProps
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TwinProps]
}>()

type DataSection = 'points' | 'events'
const section = ref<DataSection>('points')

const local = reactive<TwinProps>(emptyTwin())

watch(
  () => props.modelValue,
  value => {
    local.id = value.id
    local.points = value.points.map(p => ({ ...p }))
    local.rules = (value.rules ?? []).map(r => ({
      ...r,
      when: { ...r.when },
      then: { slots: { ...r.then.slots } }
    }))
  },
  { immediate: true, deep: true }
)

function commit() {
  emit('update:modelValue', {
    ...(local.id ? { id: local.id } : {}),
    points: local.points.map(p => ({ ...p })),
    rules: (local.rules ?? []).map(r => ({
      ...r,
      when: { ...r.when },
      then: { slots: { ...r.then.slots } }
    }))
  })
}

const usedKeys = computed(() => new Set(local.points.map(p => p.key)))

type CommPointOption = {
  value: string
  label: string
  sourceId: string
  key: string
  name: string
}

const commSources = ref<CommSource[]>([])

async function reloadCommSources() {
  commSources.value = (await loadCommBundle()).sources
}

onMounted(() => {
  void reloadCommSources()
})
watch(section, s => {
  if (s === 'points') void reloadCommSources()
})

const pointDialogVisible = ref(false)
const pointForm = reactive({
  protocol: 'http' as CommProtocol,
  pick: '' as string,
  alias: ''
})

const protocolsWithPoints = computed(() =>
  COMM_PROTOCOLS.filter(p =>
    commSources.value.some(s => s.protocol === p && s.points.length > 0)
  )
)

const availableCommOptions = computed((): CommPointOption[] => {
  const out: CommPointOption[] = []
  for (const source of commSources.value) {
    if (source.protocol !== pointForm.protocol) continue
    for (const pt of source.points) {
      if (usedKeys.value.has(pt.key)) continue
      out.push({
        value: `${source.id}::${pt.id}`,
        label: `${source.name} / ${pt.name}（${pt.key}）`,
        sourceId: source.id,
        key: pt.key,
        name: pt.name
      })
    }
  }
  return out
})

const canAddPoint = computed(() =>
  commSources.value.some(s => s.points.some(pt => !usedKeys.value.has(pt.key)))
)

async function openAddPoints() {
  await reloadCommSources()
  pointForm.protocol = protocolsWithPoints.value[0] ?? 'http'
  pointForm.pick = ''
  pointForm.alias = ''
  pointDialogVisible.value = true
}

function onProtocolChange() {
  pointForm.pick = ''
  pointForm.alias = ''
}

function onPickChange(value: string) {
  const opt = availableCommOptions.value.find(o => o.value === value)
  pointForm.alias = opt?.name ?? ''
}

function confirmAddPoints() {
  const opt = availableCommOptions.value.find(o => o.value === pointForm.pick)
  if (!opt || usedKeys.value.has(opt.key)) return
  local.points.push(
    createTwinPoint(opt.key, {
      alias: pointForm.alias.trim() || opt.name,
      source: opt.sourceId
    })
  )
  pointDialogVisible.value = false
  commit()
}

function updateAlias(point: TwinPoint, alias: string) {
  point.alias = alias.trim() || undefined
  commit()
}

function removePoint(key: string) {
  local.points = local.points.filter(p => p.key !== key)
  local.rules = (local.rules ?? []).filter(r => local.points.some(p => p.key === r.when.point))
  commit()
}

const eventDialogVisible = ref(false)
const editingEventId = ref<string | null>(null)
const eventForm = reactive({
  name: '',
  pointKey: '' as string,
  op: 'gt' as ConditionOp,
  value: 80 as number | string,
  highlight: 'fault' as DeviceStatus,
  animation: 'blink' as HighlightAnimation,
  enabled: true
})

const boundPointOptions = computed(() =>
  local.points.map(p => ({
    value: p.key,
    label: pointLabel(p.key, p.alias)
  }))
)

function openAddEvent() {
  editingEventId.value = null
  eventForm.name = ''
  eventForm.pointKey = local.points[0]?.key ?? ''
  eventForm.op = 'gt'
  eventForm.value = 80
  eventForm.highlight = 'fault'
  eventForm.animation = 'blink'
  eventForm.enabled = true
  eventDialogVisible.value = true
}

function openEditEvent(rule: TwinRule) {
  editingEventId.value = rule.id
  eventForm.name = rule.name ?? ''
  eventForm.pointKey = rule.when.point
  eventForm.op = rule.when.op
  eventForm.value = rule.when.value as number | string
  eventForm.highlight = (typeof rule.then.slots.highlight === 'string'
    ? rule.then.slots.highlight
    : 'fault') as DeviceStatus
  eventForm.animation = isHighlightAnimation(rule.then.slots.animation)
    ? rule.then.slots.animation
    : 'constant'
  eventForm.enabled = rule.enabled !== false
  eventDialogVisible.value = true
}

function confirmEvent() {
  if (!local.points.some(p => p.key === eventForm.pointKey)) return
  const payload = createTwinRule({
    id: editingEventId.value ?? undefined,
    name: eventForm.name.trim() || undefined,
    when: {
      point: eventForm.pointKey,
      op: eventForm.op,
      value: Number.isFinite(Number(eventForm.value)) ? Number(eventForm.value) : eventForm.value
    },
    then: {
      slots: {
        highlight: eventForm.highlight,
        animation: eventForm.animation
      }
    },
    enabled: eventForm.enabled
  })
  const rules = local.rules ?? (local.rules = [])
  if (editingEventId.value) {
    const index = rules.findIndex(e => e.id === editingEventId.value)
    if (index >= 0) {
      payload.id = editingEventId.value
      rules[index] = payload
    }
  } else {
    rules.push(payload)
  }
  eventDialogVisible.value = false
  commit()
}

function removeEvent(id: string) {
  local.rules = (local.rules ?? []).filter(e => e.id !== id)
  commit()
}

function toggleEvent(rule: TwinRule, enabled: boolean) {
  rule.enabled = enabled
  commit()
}

function ruleSummary(rule: TwinRule): string {
  const bound = local.points.find(p => p.key === rule.when.point)
  const label = pointLabel(rule.when.point, bound?.alias)
  const op = CONDITION_OP_LABELS[rule.when.op]
  const hlRaw = rule.then.slots.highlight
  const hl =
    typeof hlRaw === 'string'
      ? (DEVICE_STATUS_OPTIONS.find(o => o.value === hlRaw)?.label ?? hlRaw)
      : '?'
  const animRaw = rule.then.slots.animation
  const anim = isHighlightAnimation(animRaw)
    ? (HIGHLIGHT_ANIMATION_OPTIONS.find(o => o.value === animRaw)?.label ?? animRaw)
    : '常量'
  return `${label} ${op} ${rule.when.value} → ${hl}（${anim}）`
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
          <el-button size="small" type="primary" :disabled="!canAddPoint" @click="openAddPoints">
            新增
          </el-button>
        </div>
        <p class="hint">
          从「数据源」页已配置的点位中单选绑定；写入 props.twin.points。
          <RouterLink v-if="commSources.length === 0" to="/manage/sources">去配置</RouterLink>
        </p>
        <div v-if="local.points.length === 0" class="empty">尚未绑定点位</div>
        <ul v-else class="list">
          <li v-for="point in local.points" :key="point.key" class="list-item">
            <div class="item-main">
              <div class="item-title">{{ point.alias || point.key }}</div>
              <div class="item-sub">
                {{ point.key }}
                <template v-if="point.source"> · {{ point.source }}</template>
              </div>
              <el-input
                :model-value="point.alias ?? ''"
                size="small"
                placeholder="别名（可选）"
                @change="(v: string) => updateAlias(point, v)"
              />
            </div>
            <el-button type="danger" link size="small" @click="removePoint(point.key)">
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
            :disabled="local.points.length === 0"
            @click="openAddEvent"
          >
            新增
          </el-button>
        </div>
        <p class="hint">条件满足后写入 slots.highlight / slots.animation（色板与脉冲由 Host 映射）。</p>
        <div v-if="!(local.rules && local.rules.length)" class="empty">尚未配置事件</div>
        <ul v-else class="list">
          <li v-for="rule in local.rules" :key="rule.id" class="list-item">
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
        <el-form-item label="协议">
          <el-select
            v-model="pointForm.protocol"
            placeholder="选择协议"
            style="width: 100%"
            @change="onProtocolChange"
          >
            <el-option
              v-for="p in protocolsWithPoints"
              :key="p"
              :label="COMM_PROTOCOL_LABEL[p]"
              :value="p"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="选择点位">
          <el-select
            v-model="pointForm.pick"
            filterable
            clearable
            placeholder="该协议下未绑定的通信点位"
            style="width: 100%"
            @change="onPickChange"
          >
            <el-option
              v-for="opt in availableCommOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="pointForm.pick" label="别名">
          <el-input v-model="pointForm.alias" placeholder="可选，默认用变量名称" />
        </el-form-item>
        <p v-if="protocolsWithPoints.length === 0" class="hint">
          请先到「数据源」页为源添加变量点位。
        </p>
        <p v-else-if="availableCommOptions.length === 0" class="hint">
          该协议下暂无未绑定点位。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="pointDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!pointForm.pick" @click="confirmAddPoints">
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
        <el-form-item label="高亮效果">
          <el-select v-model="eventForm.highlight" style="width: 100%">
            <el-option
              v-for="opt in DEVICE_STATUS_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="动画效果">
          <el-select v-model="eventForm.animation" style="width: 100%">
            <el-option
              v-for="opt in HIGHLIGHT_ANIMATION_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="eventForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="eventDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="boundPointOptions.length === 0"
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

.hint a {
  color: #4dabf7;
  margin-left: 6px;
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
