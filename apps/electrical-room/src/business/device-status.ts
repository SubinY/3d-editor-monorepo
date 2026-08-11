import type { VisualState } from '@mh/3d-editor'

/** Host 设备运行态（不进内核 schema） */
export type DeviceStatus = 'normal' | 'warning' | 'fault' | 'offline'

export const DEVICE_STATUS_META: Record<DeviceStatus, { label: string; color: string }> = {
  normal: { label: '正常', color: '#2f6bff' },
  warning: { label: '告警', color: '#f5a623' },
  fault: { label: '故障', color: '#ff4d4f' },
  offline: { label: '离线', color: '#8c8c8c' }
}

export const STATUS_SEVERITY: Record<DeviceStatus, number> = {
  normal: 0,
  warning: 1,
  offline: 2,
  fault: 3
}

export const DEVICE_STATUS_OPTIONS: Array<{ value: DeviceStatus; label: string }> = (
  Object.keys(DEVICE_STATUS_META) as DeviceStatus[]
).map(value => ({
  value,
  label: DEVICE_STATUS_META[value].label
}))

export function isDeviceStatus(value: unknown): value is DeviceStatus {
  return typeof value === 'string' && value in DEVICE_STATUS_META
}

/** 映射为内核 VisualState（仅 color / intensity）；normal 还原材质原色 */
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
