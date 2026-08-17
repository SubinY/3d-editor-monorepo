/** 电气室 Host 点位字典（不进 twin 包） */

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
  const label = BUILTIN_POINT_LABELS[key as BuiltinPointKey] ?? key
  return alias ? `${alias}（${label}）` : label
}
