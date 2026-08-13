import type { BoundsJSON, DefaultViewJSON } from '../../../document/types'

export type CreateIndoorDefaultViewOptions = {
  /** 视线高度；默认 min(1.6, height * 0.55) */
  eyeHeight?: number
  /** 相机相对目标沿 +Z 后退距离；默认 min(width,depth) * 0.25 */
  lookDistance?: number
  fov?: number
  /** 覆盖 defaultView.type；默认 orbit */
  type?: DefaultViewJSON['type']
}

/**
 * 基于 bounds（原点在场地中心）生成室内 orbit 预设视角。
 * 不改变投影语义：仍为 orbit / orthographic，仅位姿与距离限制适合入室。
 */
export function createIndoorDefaultView(
  bounds: BoundsJSON,
  opts?: CreateIndoorDefaultViewOptions
): DefaultViewJSON {
  const width = Math.max(bounds.width, 0.5)
  const depth = Math.max(bounds.depth, 0.5)
  const height = Math.max(bounds.height ?? 2.5, 1)
  const eyeHeight = opts?.eyeHeight ?? Math.min(1.6, height * 0.55)
  const lookDistance =
    opts?.lookDistance ?? Math.max(Math.min(width, depth) * 0.25, 0.8)
  const diagonal = Math.hypot(width, depth, height)

  // 站在 +Z 一侧看向房间中心偏前，保证落在墙内
  const maxZ = depth / 2 - 0.35
  const z = Math.min(lookDistance, Math.max(maxZ, 0.4))

  return {
    type: opts?.type ?? 'orbit',
    position: [0, eyeHeight, z],
    target: [0, eyeHeight, 0],
    fov: opts?.fov ?? 60,
    minDistance: 0.3,
    maxDistance: Math.max(diagonal * 1.2, 4)
  }
}
