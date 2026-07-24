import type { CoreContext, EnginePlugin } from '@3d-editor/editor'
import { PerformanceMonitor, type PerformanceStats } from './PerformanceMonitor'

export interface PerformancePluginOptions {
  onUpdate?: (stats: PerformanceStats) => void
  name?: string
}

export const createPerformancePlugin = (options: PerformancePluginOptions = {}): EnginePlugin => {
  let monitor: PerformanceMonitor | null = null
  return {
    name: options.name || 'performance-monitor',
    setup: (ctx: CoreContext) => {
      monitor = new PerformanceMonitor(ctx)
    },
    onAfterRender: () => {
      if (!monitor) return
      const stats = monitor.update()
      options.onUpdate?.(stats)
    },
    dispose: () => {
      monitor = null
    }
  }
}
