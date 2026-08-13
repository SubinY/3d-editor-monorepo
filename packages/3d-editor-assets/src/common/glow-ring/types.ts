/** 贴地场景光圈（仅 XZ，无立面高度） */

export const PROCEDURAL_ID = 'glow-ring'

export interface GlowRingContentJSON {
  /** 外半径（米） */
  radius: number
  /** 环带宽度（米） */
  bandWidth: number
  /** 高亮段颜色（白） */
  colorA: string
  /** 主体颜色（青蓝） */
  colorB: string
  /** 高亮段占圆周比例 0–1 */
  highlightSpan: number
  /** 高亮段中心角（弧度） */
  highlightAngle: number
  /** 发光强度 */
  intensity: number
  /** 离地抬升，防 z-fight（米） */
  lift: number
}

export interface GlowRingHandle {
  root: import('three').Object3D
  mesh: import('three').Mesh
  apply: (content: GlowRingContentJSON) => void
  dispose: () => void
}
