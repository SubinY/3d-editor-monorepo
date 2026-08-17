import type { ConditionOp, PointValue, TwinProps } from './types'

export type PointValueMap = Record<string, PointValue>

/** twinId → (key → value) */
export class PointValueStore {
  private byTwin = new Map<string, PointValueMap>()

  get(twinId: string, key: string): PointValue | undefined {
    return this.byTwin.get(twinId)?.[key]
  }

  getAllForTwin(twinId: string): PointValueMap {
    return { ...(this.byTwin.get(twinId) ?? {}) }
  }

  set(twinId: string, key: string, value: PointValue): void {
    const row = this.byTwin.get(twinId) ?? {}
    row[key] = value
    this.byTwin.set(twinId, row)
  }

  setMany(twinId: string, next: PointValueMap): void {
    const row = { ...(this.byTwin.get(twinId) ?? {}), ...next }
    this.byTwin.set(twinId, row)
  }

  applySamples(samples: Array<{ twinId: string; key: string; value: PointValue }>): void {
    for (const s of samples) this.set(s.twinId, s.key, s.value)
  }

  clear(): void {
    this.byTwin.clear()
  }
}

function toNumber(value: PointValue): number {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

export function compareCondition(
  op: ConditionOp,
  left: PointValue,
  right: PointValue
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

/** 常见效果令牌软排序；Host 可用 rankHighlight 覆盖 */
export const DEFAULT_HIGHLIGHT_RANK: Record<string, number> = {
  normal: 0,
  warning: 1,
  offline: 2,
  fault: 3
}

export function defaultRankHighlight(effect: string): number {
  return DEFAULT_HIGHLIGHT_RANK[effect] ?? 0
}

/**
 * 求值规则 → highlight 令牌。
 * 仅当 point 已在 twin.points 中声明才生效；多命中取 rank 最高。
 * 无命中返回 null。
 */
export function evaluateHighlight(
  twin: TwinProps,
  values: PointValueMap,
  rankHighlight: (effect: string) => number = defaultRankHighlight
): string | null {
  const boundKeys = new Set(twin.points.map(p => p.key))
  let best: string | null = null
  let bestRank = -1
  for (const rule of twin.rules ?? []) {
    if (rule.enabled === false) continue
    if (!boundKeys.has(rule.when.point)) continue
    const raw = values[rule.when.point]
    if (raw === undefined) continue
    if (!compareCondition(rule.when.op, raw, rule.when.value)) continue
    const effect = rule.then.slots.highlight
    if (typeof effect !== 'string' || !effect) continue
    const rank = rankHighlight(effect)
    if (!best || rank > bestRank) {
      best = effect
      bestRank = rank
    }
  }
  return best
}
