import type { TransformJSON } from '../document/types'

/** 2D 拖动手柄期间的 3D 预览；不写 document / 历史 */
export interface NodeTransformPreview {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** 相对 document.scale 的均匀倍率（footprint 等比缩放预览，避免重建 mesh） */
  uniformScale?: number
}

export function composePreviewTransform(
  base: TransformJSON,
  preview: NodeTransformPreview
): TransformJSON {
  const s = preview.uniformScale ?? 1
  return {
    position: preview.position ? [...preview.position] : [...base.position],
    rotation: preview.rotation ? [...preview.rotation] : [...base.rotation],
    scale: [base.scale[0] * s, base.scale[1] * s, base.scale[2] * s]
  }
}
