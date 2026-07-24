/** 拖拽时相对其它节点边与墙面的贴边对齐吸附（纯函数） */
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
const AXIS_EPS = 1e-4

/** 将移动中物件贴边吸附到对齐线，并返回辅助线（不做中心对中心，避免叠进对方） */
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

  const uRefs: Array<{ value: number; spanFrom: number; spanTo: number }> = []
  const vRefs: Array<{ value: number; spanFrom: number; spanTo: number }> = []

  const pushU = (value: number, spanFrom: number, spanTo: number) => {
    uRefs.push({ value, spanFrom, spanTo })
  }
  const pushV = (value: number, spanFrom: number, spanTo: number) => {
    vRefs.push({ value, spanFrom, spanTo })
  }

  // 其它物件：只提供四边（贴边），不提供中心——中心互吸会整柜重叠触发碰撞
  opts.targets.forEach(t => {
    const left = t.u - t.wu / 2
    const right = t.u + t.wu / 2
    const bottom = t.v - t.wv / 2
    const top = t.v + t.wv / 2
    const halfV = t.wv / 2
    const halfU = t.wu / 2
    pushU(left, t.v - halfV, t.v + halfV)
    pushU(right, t.v - halfV, t.v + halfV)
    pushV(bottom, t.u - halfU, t.u + halfU)
    pushV(top, t.u - halfU, t.u + halfU)
  })

  // 墙：端点 + 近似轴对齐墙的中线/内外表面（按 thickness）
  opts.walls.forEach(wall => {
    const t = wall.thickness ?? 0.2
    const half = t / 2
    const midU = (wall.a[0] + wall.b[0]) / 2
    const midV = (wall.a[1] + wall.b[1]) / 2
    const minU = Math.min(wall.a[0], wall.b[0])
    const maxU = Math.max(wall.a[0], wall.b[0])
    const minV = Math.min(wall.a[1], wall.b[1])
    const maxV = Math.max(wall.a[1], wall.b[1])

    pushU(wall.a[0], wall.a[1], wall.a[1])
    pushU(wall.b[0], wall.b[1], wall.b[1])
    pushV(wall.a[1], wall.a[0], wall.a[0])
    pushV(wall.b[1], wall.b[0], wall.b[0])

    const du = Math.abs(wall.b[0] - wall.a[0])
    const dv = Math.abs(wall.b[1] - wall.a[1])
    if (du <= AXIS_EPS) {
      // 竖墙：常量 u
      pushU(wall.a[0], minV, maxV)
      pushU(wall.a[0] - half, minV, maxV)
      pushU(wall.a[0] + half, minV, maxV)
    } else if (dv <= AXIS_EPS) {
      // 横墙：常量 v
      pushV(wall.a[1], minU, maxU)
      pushV(wall.a[1] - half, minU, maxU)
      pushV(wall.a[1] + half, minU, maxU)
    } else {
      // 斜墙：至少提供中点参考
      pushU(midU, midV, midV)
      pushV(midV, midU, midU)
    }
  })

  const movingLeft = () => u - moving.wu / 2
  const movingRight = () => u + moving.wu / 2
  const movingBottom = () => v - moving.wv / 2
  const movingTop = () => v + moving.wv / 2

  type Cand = {
    delta: number
    snapTo: number
    spanFrom: number
    spanTo: number
    movingSpan: number
  }
  let bestU: Cand | undefined
  let bestV: Cand | undefined

  const considerU = (movingValue: number, ref: { value: number; spanFrom: number; spanTo: number }) => {
    const delta = ref.value - movingValue
    if (Math.abs(delta) > threshold) return
    if (!bestU || Math.abs(delta) < Math.abs(bestU.delta)) {
      bestU = {
        delta,
        snapTo: ref.value,
        spanFrom: ref.spanFrom,
        spanTo: ref.spanTo,
        movingSpan: v
      }
    }
  }
  const considerV = (movingValue: number, ref: { value: number; spanFrom: number; spanTo: number }) => {
    const delta = ref.value - movingValue
    if (Math.abs(delta) > threshold) return
    if (!bestV || Math.abs(delta) < Math.abs(bestV.delta)) {
      bestV = {
        delta,
        snapTo: ref.value,
        spanFrom: ref.spanFrom,
        spanTo: ref.spanTo,
        movingSpan: u
      }
    }
  }

  uRefs.forEach(ref => {
    considerU(movingLeft(), ref)
    considerU(movingRight(), ref)
  })
  vRefs.forEach(ref => {
    considerV(movingBottom(), ref)
    considerV(movingTop(), ref)
  })

  const guides: AlignGuide[] = []
  if (bestU) {
    u += bestU.delta
    guides.push({
      axis: 'u',
      value: bestU.snapTo,
      spanFrom: Math.min(bestU.spanFrom, bestU.spanTo, bestU.movingSpan) - 0.5,
      spanTo: Math.max(bestU.spanFrom, bestU.spanTo, bestU.movingSpan) + 0.5
    })
  }
  if (bestV) {
    v += bestV.delta
    guides.push({
      axis: 'v',
      value: bestV.snapTo,
      spanFrom: Math.min(bestV.spanFrom, bestV.spanTo, bestV.movingSpan) - 0.5,
      spanTo: Math.max(bestV.spanFrom, bestV.spanTo, bestV.movingSpan) + 0.5
    })
  }

  return { u, v, guides }
}

export function emptyGuides(): AlignGuide[] {
  return []
}

/** 兼容 PlanePoint 命名 */
export type AlignPoint = PlanePoint
