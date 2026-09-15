import type { CameraViewType, DefaultViewJSON } from '../../document/types'

/** 3D 相机看向哪里（Host 唯一写入口） */
export type CameraLookTarget =
  | { at: 'home' }
  | { at: 'pose'; view: DefaultViewJSON }
  | { at: 'top'; fit?: 'scene' | 'keep' }
  | { at: 'node'; path: string }
  | { at: 'selection' }
  | { at: 'indoor'; persist?: boolean }

export interface CameraLookOptions {
  /** 省略：home/pose 跟 view.type；top 默认 orthographic；其余保持当前或 indoor 默认 orbit */
  projection?: CameraViewType
  /** 仅 node / selection；框住包围盒的余量倍数，默认 1.4 */
  padding?: number
  /** 仅 home / pose；默认 true */
  applyPose?: boolean
}
