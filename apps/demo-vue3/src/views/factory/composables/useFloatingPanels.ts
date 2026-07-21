import { computed, ref } from 'vue'
import type { PanelType, PanelState } from '../types'

const baseZ = 20

export function useFloatingPanels() {
  const zCounter = ref(baseZ)

  const baseX = window.innerWidth - 360
  const defaultYs = [40, 320, 600]

  const createState = (
    id: PanelType,
    title: string,
    icon: string,
    pos: { x: number; y: number }
  ) => {
    const visible = ref(false)
    const position = ref({ ...pos })
    const size = ref({ w: 320, h: 260 })
    const zIndex = ref(++zCounter.value)
    return { id, title, icon, visible, position, size, zIndex } satisfies PanelState
  }

  const panels = [
    createState('production', '生产指标', '⚙️', { x: baseX, y: defaultYs[0] }),
    createState('operation', '运行指标', '⏱️', { x: baseX, y: defaultYs[1] }),
    createState('environment', '环保指标', '🍃', { x: baseX, y: defaultYs[2] })
  ]

  const togglePanel = (id: PanelType) => {
    const panel = panels.find(p => p.id === id)
    if (!panel) return
    panel.visible.value = !panel.visible.value
    bringToFront(panel)
  }

  const bringToFront = (panel: PanelState) => {
    if (panel.zIndex.value === zCounter.value) return
    panel.zIndex.value = ++zCounter.value
  }

  const setPosition = (panel: PanelState, x: number, y: number) => {
    panel.position.value = { x, y }
    bringToFront(panel)
  }

  const setSize = (panel: PanelState, w: number, h: number) => {
    panel.size.value = {
      w: Math.max(260, w),
      h: Math.max(200, h)
    }
    bringToFront(panel)
  }

  const visiblePanels = computed(() => panels.filter(p => p.visible.value))

  return {
    panels,
    visiblePanels,
    togglePanel,
    bringToFront,
    setPosition,
    setSize
  }
}
