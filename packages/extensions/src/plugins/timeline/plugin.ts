import type { CoreContext, EnginePlugin } from "@3d-editor/engine"
import { Timeline } from "./Timeline"
import { TimelinePlayer } from "./TimelinePlayer"

export interface TimelinePluginOptions {
  timeline?: Timeline
  autoPlay?: boolean
  onTick?: (time: number, timeline: Timeline) => void
  /** 是否自动将时间轴数据写回场景对象属性 */
  autoApply?: boolean
}

export const createTimelinePlugin = (options: TimelinePluginOptions = {}): EnginePlugin => {
  const timeline = options.timeline ?? new Timeline()
  let playing = options.autoPlay ?? timeline.data.autoPlay ?? false
  let time = 0
  let player: TimelinePlayer | null = null

  return {
    name: "timeline",
    setup: (ctx: CoreContext) => {
      time = 0
      if (options.autoApply !== false) {
        player = new TimelinePlayer(ctx, timeline)
      }
    },
    onBeforeRender: (_ctx: CoreContext, delta: number) => {
      if (!playing) return
      time += delta
      if (timeline.data.duration > 0 && time > timeline.data.duration) {
        if (timeline.data.loop ?? false) {
          time = 0
        } else {
          playing = false
        }
      }
      if (options.autoApply !== false && player) {
        player.apply(time)
      }
      options.onTick?.(time, timeline)
    },
    dispose: () => {
      playing = false
      player = null
    }
  }
}
