/** 节点 footprint 中心与旋转手柄平面坐标（纯函数） */
import type { PlanePoint } from '../types'

export interface NodeLayout {
  center: PlanePoint
  yaw: number
  handle: PlanePoint
  reach: number
  wu: number
  wv: number
}

/**
 * 手柄极角 φ：与 `handle = (sin φ, cos φ)` 一致（φ=0 指向 +v）。
 * 注意与数学常规 atan2(dv, du) 参数顺序相反。
 */
export function planeHandleAngle(du: number, dv: number): number {
  return Math.atan2(du, dv)
}

/**
 * document yaw（顺时针世界角分量）→ 2D 平面显示角。
 * yaw 已与 canvas `ctx.rotate` 同向（顺时针），不再取反。
 */
export function yawToDisplayAngle(yaw: number, _isElevation?: boolean): number {
  return yaw
}

export function displayAngleToYaw(displayAngle: number, _isElevation?: boolean): number {
  return displayAngle
}

export function computeNodeLayout(opts: {
  isElevation: boolean
  plane: PlanePoint
  yaw: number
  wu: number
  wv: number
}): NodeLayout {
  const { isElevation, plane, yaw, wu, wv } = opts
  const center = {
    u: plane.u,
    v: isElevation ? plane.v + wv / 2 : plane.v,
  }
  const reach = Math.max(wu, wv) / 2 + Math.max(0.18, Math.min(wu, wv) * 0.4)
  const displayAngle = yawToDisplayAngle(yaw, isElevation)
  const handle = {
    u: center.u + Math.sin(displayAngle) * reach,
    v: center.v + Math.cos(displayAngle) * reach,
  }
  return { center, yaw, handle, reach, wu, wv }
}
