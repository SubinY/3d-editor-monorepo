import type { CameraViewType, DefaultViewJSON } from '../../document/types'

/** 3D 相机看向哪里（Host 唯一写入口） */
export type CameraLookTarget =
  | { at: 'home' }
  | { at: 'pose'; view: DefaultViewJSON }
  | { at: 'top'; fit?: 'scene' | 'keep' }
  /** 正面（+Z），默认正交；与 captureSnapshop / top 对称 */
  | { at: 'front' }
  | { at: 'node'; path: string }
  | { at: 'selection' }
  | { at: 'indoor'; persist?: boolean }

export interface CameraLookOptions {
  /** 省略：home/pose 跟 view.type；top/front 默认 orthographic；其余保持当前或 indoor 默认 orbit */
  projection?: CameraViewType
  /** node / selection / front；框住包围盒的余量倍数。node/selection 默认 1.4；front 默认 1.15 */
  padding?: number
  /** 仅 home / pose；默认 true */
  applyPose?: boolean
}

/** 离屏静帧：不改用户 Orbit，固定分辨率出 PNG */
export interface CaptureSnapshopOptions {
  at?: 'front' | 'home' | 'top'
  projection?: CameraViewType
  /** 默认 512 */
  width?: number
  /** 默认 768 */
  height?: number
  /** front 框选余量；默认 1.15 */
  padding?: number
  /** 藏网格 / TransformControls；默认 true */
  hideHelpers?: boolean
}
