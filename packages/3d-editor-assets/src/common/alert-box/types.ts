/** 告警/电子围栏：空心方框立面 + 扫描流光 */

export const PROCEDURAL_ID = 'alert-box'

export interface AlertBoxContentJSON {
  /** X 方向外廓（米） */
  width: number
  /** Z 方向外廓（米） */
  depth: number
  /** 光墙高度（米） */
  height: number
  /** 告警色 */
  color: string
  /** 发光强度 */
  intensity: number
  /** 向上衰减陡峭度（越大顶部越淡） */
  fadePower: number
}

export interface AlertBoxHandle {
  root: import('three').Object3D
  apply: (content: AlertBoxContentJSON) => void
  dispose: () => void
}
