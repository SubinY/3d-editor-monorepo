import type { CoreContext, Track } from '@3d-editor/editor'
import type { Timeline } from './Timeline'

/**
 * 将 Timeline 数据驱动到 Three.js 对象属性的轻量播放器。
 * 当前实现支持 number / vector3 / color / quaternion 的线性插值。
 */
export class TimelinePlayer {
  constructor(private ctx: CoreContext, private timeline: Timeline) {}

  apply(time: number): void {
    const scene = this.ctx.scene
    this.timeline.data.tracks.forEach(track => {
      const object = scene.getObjectByProperty('uuid', track.targetId)
      if (!object) return
      const value = this.interpolate(track, time)
      if (value === undefined) return
      this.applyValue(object, track.property, track.type, value)
    })
  }

  private interpolate(track: Track, time: number): unknown {
    const keyframes = track.keyframes
    if (!keyframes || keyframes.length === 0) return undefined
    if (keyframes.length === 1) return keyframes[0].value
    const sorted = [...keyframes].sort((a, b) => a.time - b.time)
    if (time <= sorted[0].time) return sorted[0].value
    if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value
    const nextIndex = sorted.findIndex(k => k.time >= time)
    const prev = sorted[nextIndex - 1]
    const next = sorted[nextIndex]
    const t = (time - prev.time) / Math.max(next.time - prev.time, 1e-6)
    return this.lerpValues(prev.value, next.value, t, track)
  }

  private lerpValues(a: unknown, b: unknown, t: number, track: Track): unknown {
    if (track.type === 'vector3' || Array.isArray(a) || Array.isArray(b)) {
      const va = Array.isArray(a) ? a : [0, 0, 0]
      const vb = Array.isArray(b) ? b : [0, 0, 0]
      return [0, 1, 2].map(i => this.lerpNumber(va[i] ?? 0, vb[i] ?? 0, t))
    }
    if (track.type === 'quaternion') {
      const qa = Array.isArray(a) ? a : [0, 0, 0, 1]
      const qb = Array.isArray(b) ? b : [0, 0, 0, 1]
      return [0, 1, 2, 3].map(i => this.lerpNumber(qa[i] ?? 0, qb[i] ?? 0, t))
    }
    if (track.type === 'color') {
      // 仅做数值插值（0-1 或 0-255），字符串颜色将直接返回起点
      if (typeof a === 'number' && typeof b === 'number') {
        return this.lerpNumber(a, b, t)
      }
      return a
    }
    if (typeof a === 'number' && typeof b === 'number') {
      return this.lerpNumber(a, b, t)
    }
    return a
  }

  private lerpNumber(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  private applyValue(object: any, propertyPath: string, type: Track['type'], value: unknown): void {
    const segments = propertyPath.split('.')
    let target = object as any
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments[i]
      if (!target[key]) return
      target = target[key]
    }
    const last = segments[segments.length - 1]

    if (type === 'vector3' && Array.isArray(value) && target[last]?.set) {
      target[last].set(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0)
      return
    }
    if (type === 'quaternion' && Array.isArray(value) && target[last]?.set) {
      target[last].set(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 1)
      return
    }
    if (type === 'color' && target[last]?.set) {
      target[last].set(value as any)
      return
    }

    // 标量或直接赋值
    if (typeof value === 'number' || typeof value === 'string') {
      target[last] = value as never
    } else if (Array.isArray(value) && target[last]?.fromArray) {
      target[last].fromArray(value as number[])
    }
  }
}

