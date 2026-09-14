/** 选中节点四角手柄：屏幕左上/右上/左下/右下 */
import type { FootprintSpec } from '../../../catalog/types'
import type { PlanePoint } from '../types'

export type SelectionHandleKind = 'rotate' | 'lift' | 'slideV' | 'scale'

export const SELECTION_HANDLE_KINDS: SelectionHandleKind[] = [
  'rotate',
  'lift',
  'slideV',
  'scale'
]

/** 手柄中心相对 AABB 角点的外扩（平面米）；调用方传入 px/scale */
export interface SelectionHandles {
  rotate: PlanePoint
  lift: PlanePoint
  slideV: PlanePoint
  scale: PlanePoint
}

/**
 * AABB 四角手柄。角点按**屏幕**上下（不是世界 +v）：
 * - 俯视 scene：sy 随 v 增大，屏幕上方 = 更小 v
 * - 立面 container：sy 随 v 减小，屏幕上方 = 更大 v
 */
export function computeSelectionHandles(opts: {
  isElevation: boolean
  center: PlanePoint
  eu: number
  ev: number
  pad: number
}): SelectionHandles {
  const { isElevation, center, eu, ev, pad } = opts
  const left = center.u - eu - pad
  const right = center.u + eu + pad
  const screenUp = isElevation ? 1 : -1
  const top = center.v + screenUp * (ev + pad)
  const bottom = center.v - screenUp * (ev + pad)
  return {
    rotate: { u: left, v: top },
    lift: { u: right, v: top },
    slideV: { u: left, v: bottom },
    scale: { u: right, v: bottom }
  }
}

export function hitTestSelectionHandle(
  handles: SelectionHandles,
  u: number,
  v: number,
  scale: number
): SelectionHandleKind | null {
  const threshold = Math.max(0.12, 14 / scale)
  let best: SelectionHandleKind | null = null
  let bestDist = threshold
  for (const kind of SELECTION_HANDLE_KINDS) {
    const h = handles[kind]
    const dist = Math.hypot(u - h.u, v - h.v)
    if (dist <= bestDist) {
      bestDist = dist
      best = kind
    }
  }
  return best
}

/** 屏幕向上对应的平面 Δv：立面 +v 向上，俯视 +v 向下 */
export function screenUpDeltaV(isElevation: boolean, dv: number): number {
  return isElevation ? dv : -dv
}

const MIN_FOOTPRINT = 0.02
const MAX_SCALE_RATIO = 20

/** 拖拽距离比 → 三轴等比 footprint（相对按下时的尺寸） */
export function uniformFootprintFromRatio(
  start: FootprintSpec,
  ratio: number
): FootprintSpec {
  const height = start.height ?? start.depth
  const minDim = Math.min(start.width, start.depth, height, 1)
  const clamped = Math.min(
    MAX_SCALE_RATIO,
    Math.max(MIN_FOOTPRINT / Math.max(minDim, 1e-6), ratio)
  )
  return {
    width: start.width * clamped,
    depth: start.depth * clamped,
    height: height * clamped
  }
}
