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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function jitter(base: number, amp: number) {
  return base + (Math.random() - 0.5) * 2 * amp
}

export const useRuntimeStore = defineStore('runtime', () => {
  const devices = ref<RuntimeDevice[]>([])
  const alarms = ref<RuntimeAlarm[]>([])
  const selectedNodeId = ref('')
  const updatedAt = ref('')
  const running = ref(false)

  let timer: number | undefined

  const metrics = computed(() => {
    const list = devices.value
    if (!list.length) {
      return {
        voltage: 0,
        current: 0,
        temperature: 0,
        powerFactor: 0
      }
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
    const systemOk = alarm === 0
    return { normal, warning, alarm, systemOk, total: devices.value.length }
  })

  const selectedDevice = computed(
    () => devices.value.find(d => d.nodeId === selectedNodeId.value) ?? null
  )

  function seedFromNodes(
    nodes: Array<{ id: string; name?: string; props?: Record<string, unknown> }>
  ) {
    const cabinets = nodes.filter(n => {
      const code = n.props?.deviceCode
      return typeof code === 'string' || /柜/.test(n.name ?? '')
    })

    devices.value = cabinets.map((n, i) => {
      const code =
        typeof n.props?.deviceCode === 'string'
          ? n.props.deviceCode
          : `C-${String(i + 1).padStart(2, '0')}`
      let status: DeviceStatus = 'normal'
      if (i === 2) status = 'fault'
      else if (i === 1 || i === 4) status = 'warning'

      return {
        nodeId: n.id,
        code,
        name: n.name || `设备-${i + 1}`,
        status,
        voltage: 380 + (Math.random() - 0.5) * 2,
        current: 80 + Math.random() * 100,
        temperature: 38 + Math.random() * 15,
        powerFactor: 0.88 + Math.random() * 0.1
      }
    })

    rebuildAlarms()
    if (!selectedNodeId.value && devices.value.length) {
      selectedNodeId.value = devices.value[0].nodeId
    }
    tickClock()
  }

  function rebuildAlarms() {
    const next: RuntimeAlarm[] = []
    for (const d of devices.value) {
      if (d.status === 'fault') {
        next.push({
          id: `a-${d.nodeId}-t`,
          deviceCode: d.code,
          deviceName: d.name,
          message: '温度超限',
          level: 'high',
          time: formatTime(new Date(Date.now() - 80000))
        })
      } else if (d.status === 'warning') {
        next.push({
          id: `a-${d.nodeId}-i`,
          deviceCode: d.code,
          deviceName: d.name,
          message: d.powerFactor < 0.9 ? '功率因数偏低' : '电流异常',
          level: 'medium',
          time: formatTime(new Date(Date.now() - 120000 - Math.random() * 60000))
        })
      }
    }
    alarms.value = next.slice(0, 8)
  }

  function tick() {
    devices.value = devices.value.map(d => {
      const voltage = clamp(jitter(d.voltage, 0.4), 370, 390)
      const current = clamp(jitter(d.current, 3), 20, 220)
      const temperature = clamp(jitter(d.temperature, 0.6), 25, 75)
      const powerFactor = clamp(jitter(d.powerFactor, 0.01), 0.7, 0.99)
      return { ...d, voltage, current, temperature, powerFactor }
    })
    tickClock()
  }

  function tickClock() {
    const now = new Date()
    updatedAt.value = formatDateTime(now)
  }

  function start() {
    if (running.value) return
    running.value = true
    timer = window.setInterval(tick, 2000)
  }

  function stop() {
    running.value = false
    if (timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  }

  function selectDevice(nodeId: string) {
    selectedNodeId.value = nodeId
  }

  return {
    devices,
    alarms,
    selectedNodeId,
    updatedAt,
    running,
    metrics,
    statusSummary,
    selectedDevice,
    seedFromNodes,
    start,
    stop,
    selectDevice,
    DEVICE_STATUS_META
  }
})

function formatTime(d: Date) {
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

function formatDateTime(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day} ${formatTime(d)}`
}
