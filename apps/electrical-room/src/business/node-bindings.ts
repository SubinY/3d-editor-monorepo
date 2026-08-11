import type { EditorDocument, EditorNodeJSON } from '@mh/3d-editor'
import {
  DEVICE_STATUS_OPTIONS,
  isDeviceStatus,
  type DeviceStatus
} from './device-status'

/** 内置点位 key（Host 约定，不进内核 schema） */
export const BUILTIN_POINT_KEYS = [
  'temp',
  'humidity',
  'voltage',
  'current',
  'power',
  'pressure',
  'speed',
  'status',
  'alarm',
  'online'
] as const

export type BuiltinPointKey = (typeof BUILTIN_POINT_KEYS)[number]

export const BUILTIN_POINT_LABELS: Record<BuiltinPointKey, string> = {
  temp: '温度',
  humidity: '湿度',
  voltage: '电压',
  current: '电流',
  power: '功率',
  pressure: '压力',
  speed: '转速',
  status: '设备状态码',
  alarm: '告警码',
  online: '在线'
}

export interface PointBinding {
  id: string
  key: BuiltinPointKey
  alias?: string
  createdAt: number
}

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'

export interface ConditionWhen {
  pointKey: BuiltinPointKey
  op: ConditionOp
  value: number | string | boolean
}

export interface NodeEventRule {
  id: string
  name?: string
  kind: 'condition' | 'script'
  when: ConditionWhen
  then: { highlight: DeviceStatus }
  enabled?: boolean
}

export interface NodeBindingsProps {
  bindings: PointBinding[]
  events: NodeEventRule[]
}

export const CONDITION_OP_LABELS: Record<ConditionOp, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤'
}

/** 事件「触发高亮」下拉；色值语义见 device-status */
export const HIGHLIGHT_STATUS_OPTIONS = DEVICE_STATUS_OPTIONS

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function emptyNodeBindings(): NodeBindingsProps {
  return {
    bindings: [],
    events: []
  }
}

export function readNodeBindings(node: EditorNodeJSON | undefined | null): NodeBindingsProps {
  const props = (node?.props ?? {}) as Record<string, unknown>
  const bindings = Array.isArray(props.bindings)
    ? (props.bindings as PointBinding[]).filter(
        b => b && typeof b.key === 'string' && BUILTIN_POINT_KEYS.includes(b.key as BuiltinPointKey)
      )
    : []
  const events = Array.isArray(props.events)
    ? (props.events as NodeEventRule[])
        .filter(e => e && isDeviceStatus(e.then?.highlight))
        .map(e => ({
          ...e,
          when: { ...e.when },
          then: { highlight: e.then.highlight }
        }))
    : []
  return { bindings, events }
}

/** shallow merge 注意：一次写出 bindings/events 全量 */
export function writeNodeBindings(
  doc: EditorDocument,
  nodeId: string,
  next: NodeBindingsProps
): void {
  const node = doc.getNode(nodeId)
  if (!node) return
  const rest: Record<string, unknown> = { ...(node.props ?? {}) }
  delete rest.appearance
  delete rest.bindings
  delete rest.events
  doc.commands.updateNode(nodeId, {
    props: {
      ...rest,
      bindings: next.bindings.map(b => ({ ...b })),
      events: next.events.map(e => ({
        ...e,
        when: { ...e.when },
        then: { ...e.then }
      }))
    }
  })
}

export function createPointBinding(key: BuiltinPointKey, alias?: string): PointBinding {
  return {
    id: createId('pt'),
    key,
    alias: alias?.trim() || undefined,
    createdAt: Date.now()
  }
}

export function createConditionEvent(partial?: Partial<NodeEventRule>): NodeEventRule {
  return {
    id: partial?.id ?? createId('ev'),
    name: partial?.name,
    kind: 'condition',
    when: partial?.when ?? { pointKey: 'temp', op: 'gt', value: 80 },
    then: partial?.then ?? { highlight: 'fault' },
    enabled: partial?.enabled ?? true
  }
}

export function pointDisplayName(binding: PointBinding): string {
  const label = BUILTIN_POINT_LABELS[binding.key] ?? binding.key
  return binding.alias ? `${binding.alias}（${label}）` : label
}
