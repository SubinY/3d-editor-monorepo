import { loadImage } from '../../utils/load-image'
import type { PanelContentJSON } from './types'

/** 离屏 canvas 烘焙；编辑预览与 Sprite 贴图共用 */
export async function bakeToCanvas(
  content: PanelContentJSON,
  target?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const canvas = target ?? document.createElement('canvas')
  canvas.width = Math.max(64, Math.floor(content.width))
  canvas.height = Math.max(64, Math.floor(content.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (content.background && content.background !== 'transparent') {
    ctx.fillStyle = content.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  if (content.backgroundImage) {
    const bg = await loadImage(content.backgroundImage)
    if (bg) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height)
  }

  for (const el of content.elements) {
    if (el.type === 'text') {
      if (el.background) {
        ctx.fillStyle = el.background
        ctx.fillRect(el.left, el.top, el.width, el.height)
      }
      const size = el.fontSize ?? 32
      ctx.font = `${el.fontWeight ?? 600} ${size}px ${el.fontFamily ?? 'Arial, sans-serif'}`
      ctx.fillStyle = el.color ?? '#ffffff'
      ctx.textAlign = el.align ?? 'left'
      ctx.textBaseline = el.baseline ?? 'middle'
      const x =
        el.align === 'center'
          ? el.left + el.width / 2
          : el.align === 'right'
            ? el.left + el.width
            : el.left + 12
      const y = el.top + el.height / 2
      ctx.lineWidth = Math.max(2, size / 28)
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.strokeText(el.text, x, y)
      ctx.fillText(el.text, x, y)
    } else {
      const img = await loadImage(el.url)
      if (!img) {
        ctx.fillStyle = 'rgba(80,120,80,0.85)'
        ctx.fillRect(el.left, el.top, el.width, el.height)
      } else {
        ctx.save()
        ctx.globalAlpha = el.opacity ?? 1
        ctx.drawImage(img, el.left, el.top, el.width, el.height)
        ctx.restore()
      }
    }
  }
  return canvas
}
