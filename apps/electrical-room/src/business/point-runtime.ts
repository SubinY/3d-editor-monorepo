import type { ConditionOp, NodeBindingsProps, NodeEventRule } from './node-bindings'
import { STATUS_SEVERITY, type DeviceStatus } from './device-status'

export type PointValueMap = Record<string, number | string | boolean>

export class PointValueStore {
  private values: PointValueMap = {}

  getAll(): PointValueMap {
    return { ...this.values }
  }

  get(key: string): number | string | boolean | undefined {
    return this.values[key]
  }

  setMany(next: PointValueMap): void {
    this.values = { ...this.values, ...next }
  }

  clear(): void {
    this.values = {}
  }
}

function toNumber(value: number | string | boolean): number {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function compare(
  op: ConditionOp,
  left: number | string | boolean,
  right: number | string | boolean
): boolean {
  if (op === 'eq') return left === right || toNumber(left) === toNumber(right)
  if (op === 'neq') return left !== right && toNumber(left) !== toNumber(right)
  const a = toNumber(left)
  const b = toNumber(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  switch (op) {
    case 'gt':
      return a > b
    case 'gte':
      return a >= b
    case 'lt':
      return a < b
    case 'lte':
      return a <= b
  }
}

function evalCondition(rule: NodeEventRule, values: PointValueMap): boolean {
  if (rule.kind !== 'condition' || rule.enabled === false) return false
  const raw = values[rule.when.pointKey]
  if (raw === undefined) return false
  return compare(rule.when.op, raw, rule.when.value)
}

/**
 * 求值所有命中规则，按严重度取最高 DeviceStatus。
 * 无命中返回 null（调用方按 normal 处理）。
 */
export function evaluateNodeRules(
  bindings: NodeBindingsProps,
  values: PointValueMap
): DeviceStatus | null {
  const boundKeys = new Set(bindings.bindings.map(b => b.key))
  let best: DeviceStatus | null = null
  for (const rule of bindings.events) {
    if (rule.kind !== 'condition') continue
    if (!boundKeys.has(rule.when.pointKey)) continue
    if (!evalCondition(rule, values)) continue
    const status = rule.then.highlight
    if (!best || STATUS_SEVERITY[status] > STATUS_SEVERITY[best]) {
      best = status
    }
  }
  return best
}
