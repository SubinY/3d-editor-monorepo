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
    v: isElevation ? plane.v + wv / 2 : plane.v
  }
  const reach = Math.max(wu, wv) / 2 + Math.max(0.18, Math.min(wu, wv) * 0.4)
  const displayAngle = isElevation ? yaw : -yaw
  const handle = {
    u: center.u + Math.sin(displayAngle) * reach,
    v: center.v + Math.cos(displayAngle) * reach
  }
  return { center, yaw, handle, reach, wu, wv }
}
