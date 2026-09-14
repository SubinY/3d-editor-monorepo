/** 选中 AABB 四角按钮：内置 SVG 图标 */
import type { Theme2D } from '../types'
import type { SelectionHandleKind } from '../utils/selection-handles'
import { getSelectionHandleIcon } from '../assets/handles'

const HANDLE_R = 10
const ICON_SIZE = 12

/** 对角缩放箭头 → 竖直双向（canvas 正旋为顺时针，故取 -π/4） */
const SLIDE_V_ROTATION = -Math.PI / 4

export function drawSelectionHandleButton(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  kind: SelectionHandleKind,
  color: string,
  _theme: Theme2D
): void {
  ctx.save()
  ctx.translate(sx, sy)

  ctx.beginPath()
  ctx.arc(0, 0, HANDLE_R, 0, Math.PI * 2)
  ctx.fillStyle = '#f4f7fb'
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.4
  ctx.stroke()

  const icon = getSelectionHandleIcon(kind)
  if (icon) {
    if (kind === 'slideV') ctx.rotate(SLIDE_V_ROTATION)
    ctx.drawImage(icon, -ICON_SIZE / 2, -ICON_SIZE / 2, ICON_SIZE, ICON_SIZE)
  }

  ctx.restore()
}
