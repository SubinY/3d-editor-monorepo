/** 电气室 Host 点位展示（不进 twin 包） */

export const CONDITION_OP_LABELS: Record<
  'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte',
  string
> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤'
}

export function pointLabel(key: string, alias?: string): string {
  const name = alias?.trim()
  return name ? `${name}（${key}）` : key
}
