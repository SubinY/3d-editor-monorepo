import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DeviceStatus } from '@/utils/visual-state-map'
import { DEVICE_STATUS_META } from '@/utils/visual-state-map'

export type RuntimeDevice = {
  nodeId: string
  code: string
  name: string
  status: DeviceStatus
  voltage: number
  current: number
  temperature: number
  powerFactor: number
}

export type RuntimeAlarm = {
  id: string
  deviceCode: string
  deviceName: string
  message: string
  level: 'high' | 'medium' | 'low'
  time: string
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

function formatDateTime(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day} ${formatTime(d)}`
}

function toStatus(effect: string | null): DeviceStatus {
  if (effect === 'warning' || effect === 'fault' || effect === 'offline') return effect
  return 'normal'
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export const useRuntimeStore = defineStore('runtime', () => {
  const devices = ref<RuntimeDevice[]>([])
  const alarms = ref<RuntimeAlarm[]>([])
  const selectedNodeId = ref('')
  const updatedAt = ref('')

  const metrics = computed(() => {
    const list = devices.value
    if (!list.length) {
      return { voltage: 0, current: 0, temperature: 0, powerFactor: 0 }
    }
    const voltage = list.reduce((s, d) => s + d.voltage, 0) / list.length
    const current = list.reduce((s, d) => s + d.current, 0)
    const temperature = list.reduce((s, d) => s + d.temperature, 0) / list.length
    const powerFactor = list.reduce((s, d) => s + d.powerFactor, 0) / list.length
    return { voltage, current, temperature, powerFactor }
  })

  const statusSummary = computed(() => {
    let normal = 0
    let warning = 0
    let alarm = 0
    for (const d of devices.value) {
      if (d.status === 'normal') normal++
      else if (d.status === 'warning') warning++
      else if (d.status === 'fault') alarm++
    }
    return {
      normal,
      warning,
      alarm,
      systemOk: alarm === 0,
      total: devices.value.length
    }
  })

  const selectedDevice = computed(
    () => devices.value.find(d => d.nodeId === selectedNodeId.value) ?? null
  )

  /**
   * 由 TwinPlayer onPaint 驱动：节点列表 + 效果令牌 + 点值表。
   */
  function applyPaint(
    rows: Array<{
      nodeId: string
      name: string
      twinId: string
      effect: string | null
      values: Record<string, number | string | boolean>
      deviceCode?: string
    }>
  ) {
    devices.value = rows.map((r, i) => {
      const status = toStatus(r.effect)
      return {
        nodeId: r.nodeId,
        code: r.deviceCode || r.twinId || `C-${String(i + 1).padStart(2, '0')}`,
        name: r.name,
        status,
        voltage: num(r.values.voltage, 380),
        current: num(r.values.current, 80),
        temperature: num(r.values.temp, 40),
        powerFactor: num(r.values.power, 0.9)
      }
    })

    const next: RuntimeAlarm[] = []
    for (const d of devices.value) {
      if (d.status === 'fault') {
        next.push({
          id: `a-${d.nodeId}-fault`,
          deviceCode: d.code,
          deviceName: d.name,
          message: d.temperature > 60 ? '温度超限' : '故障',
          level: 'high',
          time: formatTime(new Date())
        })
      } else if (d.status === 'warning') {
        next.push({
          id: `a-${d.nodeId}-warn`,
          deviceCode: d.code,
          deviceName: d.name,
          message: '预警',
          level: 'medium',
          time: formatTime(new Date())
        })
      }
    }
    alarms.value = next.slice(0, 8)

    if (!selectedNodeId.value && devices.value.length) {
      selectedNodeId.value = devices.value[0].nodeId
    }
    updatedAt.value = formatDateTime(new Date())
  }

  function selectDevice(nodeId: string) {
    selectedNodeId.value = nodeId
  }

  return {
    devices,
    alarms,
    selectedNodeId,
    updatedAt,
    metrics,
    statusSummary,
    selectedDevice,
    applyPaint,
    selectDevice,
    DEVICE_STATUS_META
  }
})
