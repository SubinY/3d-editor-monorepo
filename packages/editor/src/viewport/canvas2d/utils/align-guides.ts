/** 拖拽时相对其它节点边/中心与墙端点的对齐吸附（纯函数） */
import type { WallJSON } from '../../../document/types'
import type { PlanePoint } from '../types'

export interface AlignTarget {
  /** 中心 u/v */
  u: number
  v: number
  wu: number
  wv: number
}

export interface AlignGuide {
  /** v 线 = 水平（常量 v）；u 线 = 竖直（常量 u） */
  axis: 'u' | 'v'
  value: number
  /** 绘制用跨度 */
  spanFrom: number
  spanTo: number
}

export interface AlignResult {
  u: number
  v: number
  guides: AlignGuide[]
}

const DEFAULT_THRESHOLD = 0.12

/** 将移动中物件中心吸附到对齐线，并返回辅助线 */
export function snapWithAlignGuides(opts: {
  moving: AlignTarget
  targets: AlignTarget[]
  walls: WallJSON[]
  threshold?: number
}): AlignResult {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD
  const { moving } = opts
  let u = moving.u
  let v = moving.v

  const uRefs: Array<{ value: number; span: number }> = []
  const vRefs: Array<{ value: number; span: number }> = []

  const pushBox = (t: AlignTarget) => {
    const left = t.u - t.wu / 2
    const right = t.u + t.wu / 2
    const bottom = t.v - t.wv / 2
    const top = t.v + t.wv / 2
    uRefs.push(
      { value: t.u, span: t.v },
      { value: left, span: t.v },
      { value: right, span: t.v }
    )
    vRefs.push(
      { value: t.v, span: t.u },
      { value: bottom, span: t.u },
      { value: top, span: t.u }
    )
  }

  opts.targets.forEach(pushBox)
  opts.walls.forEach(wall => {
    uRefs.push({ value: wall.a[0], span: wall.a[1] }, { value: wall.b[0], span: wall.b[1] })
    vRefs.push({ value: wall.a[1], span: wall.a[0] }, { value: wall.b[1], span: wall.b[0] })
  })

  const movingLeft = u - moving.wu / 2
  const movingRight = u + moving.wu / 2
  const movingBottom = v - moving.wv / 2
  const movingTop = v + moving.wv / 2

  type Cand = { delta: number; snapTo: number; refSpan: number; movingSpan: number }
  let bestU: Cand | undefined
  let bestV: Cand | undefined

  const considerU = (movingValue: number, ref: { value: number; span: number }) => {
    const delta = ref.value - movingValue
    if (Math.abs(delta) > threshold) return
    if (!bestU || Math.abs(delta) < Math.abs(bestU.delta)) {
      bestU = { delta, snapTo: ref.value, refSpan: ref.span, movingSpan: v }
    }
  }
  const considerV = (movingValue: number, ref: { value: number; span: number }) => {
    const delta = ref.value - movingValue
    if (Math.abs(delta) > threshold) return
    if (!bestV || Math.abs(delta) < Math.abs(bestV.delta)) {
      bestV = { delta, snapTo: ref.value, refSpan: ref.span, movingSpan: u }
    }
  }

  uRefs.forEach(ref => {
    considerU(u, ref)
    considerU(movingLeft, ref)
    considerU(movingRight, ref)
  })
  vRefs.forEach(ref => {
    considerV(v, ref)
    considerV(movingBottom, ref)
    considerV(movingTop, ref)
  })

  const guides: AlignGuide[] = []
  if (bestU) {
    // 中心/边吸附到 ref：用 delta 平移整个物件
    u += bestU.delta
    guides.push({
      axis: 'u',
      value: bestU.snapTo,
      spanFrom: Math.min(bestU.refSpan, bestU.movingSpan) - 0.5,
      spanTo: Math.max(bestU.refSpan, bestU.movingSpan) + 0.5
    })
  }
  if (bestV) {
    v += bestV.delta
    guides.push({
      axis: 'v',
      value: bestV.snapTo,
      spanFrom: Math.min(bestV.refSpan, bestV.movingSpan) - 0.5,
      spanTo: Math.max(bestV.refSpan, bestV.movingSpan) + 0.5
    })
  }

  return { u, v, guides }
}

export function emptyGuides(): AlignGuide[] {
  return []
}

/** 兼容 PlanePoint 命名 */
export type AlignPoint = PlanePoint
