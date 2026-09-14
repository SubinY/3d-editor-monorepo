/** 2D 选中四角手柄图标（SVG 内置） */
import type { SelectionHandleKind } from '../utils/selection-handles'
import rotateSvg from './handle-rotate.svg?raw'
import liftSvg from './handle-lift.svg?raw'
import scaleSvg from './handle-scale.svg?raw'

/** slideV 与 scale 共用对角双向箭头；slideV 绘制时再旋转为竖直 */
const SVG_BY_KIND: Record<SelectionHandleKind, string> = {
  rotate: rotateSvg,
  lift: liftSvg,
  slideV: scaleSvg,
  scale: scaleSvg
}

const images = new Map<SelectionHandleKind, HTMLImageElement>()
let loadPromise: Promise<void> | null = null

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('selection handle svg failed to load'))
    img.src = toDataUrl(svg)
  })
}

/** 预加载四角 SVG；完成后可触发 2D 重绘 */
export function ensureSelectionHandleIcons(): Promise<void> {
  if (images.size === 4) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = Promise.all(
    (Object.keys(SVG_BY_KIND) as SelectionHandleKind[]).map(async kind => {
      const img = await loadImage(SVG_BY_KIND[kind])
      images.set(kind, img)
    })
  ).then(() => undefined)
  return loadPromise
}

export function getSelectionHandleIcon(kind: SelectionHandleKind): HTMLImageElement | undefined {
  return images.get(kind)
}
