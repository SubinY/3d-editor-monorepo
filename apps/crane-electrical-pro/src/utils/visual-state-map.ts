import type { VisualState } from '@mh/3d-editor'

export type DeviceStatus = 'normal' | 'warning' | 'fault' | 'offline'

export const DEVICE_STATUS_META: Record<
  DeviceStatus,
  { label: string; color: string; runLabel: string }
> = {
  normal: { label: '正常', color: '#22C55E', runLabel: '正常运行' },
  warning: { label: '预警', color: '#F59E0B', runLabel: '预警' },
  fault: { label: '报警', color: '#EF4444', runLabel: '故障报警' },
  offline: { label: '离线', color: '#64748B', runLabel: '离线' }
}

/** Host 状态 → 内核 VisualState（不落库） */
export function toVisualState(status: DeviceStatus, intensity = 1): VisualState {
  if (status === 'normal') return { color: null }
  return {
    color: DEVICE_STATUS_META[status].color,
    intensity
  }
}

export function clearVisualState(): VisualState {
  return { color: null }
}
