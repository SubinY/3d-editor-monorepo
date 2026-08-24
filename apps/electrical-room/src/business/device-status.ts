import type { VisualState } from '@mh/3d-editor'

/** Host 设备运行态（不进内核 schema） */
export type DeviceStatus = 'normal' | 'warning' | 'fault' | 'offline'

/** 高亮动画：常量常亮 / 闪烁脉冲（写入 twin then.slots.animation） */
export type HighlightAnimation = 'constant' | 'blink'

export const DEVICE_STATUS_META: Record<DeviceStatus, { label: string; color: string }> = {
  normal: { label: '正常', color: '#2f6bff' },
  warning: { label: '告警', color: '#f5a623' },
  fault: { label: '故障', color: '#ff4d4f' },
  offline: { label: '离线', color: '#8c8c8c' }
}

export const DEVICE_STATUS_OPTIONS: Array<{ value: DeviceStatus; label: string }> = (
  Object.keys(DEVICE_STATUS_META) as DeviceStatus[]
).map(value => ({
  value,
  label: DEVICE_STATUS_META[value].label
}))

export const HIGHLIGHT_ANIMATION_OPTIONS: Array<{ value: HighlightAnimation; label: string }> = [
  { value: 'constant', label: '常亮' },
  { value: 'blink', label: '闪烁' }
]

export function isDeviceStatus(value: unknown): value is DeviceStatus {
  return typeof value === 'string' && value in DEVICE_STATUS_META
}

export function isHighlightAnimation(value: unknown): value is HighlightAnimation {
  return value === 'constant' || value === 'blink'
}

/** 映射为内核 VisualState（色板）；是否脉冲由 TwinPlayer 按 slots.animation 覆盖 */
export function toVisualState(status: DeviceStatus, intensity = 1): VisualState {
  if (status === 'normal') return { color: null }
  return {
    color: DEVICE_STATUS_META[status].color,
    intensity
  }
}
