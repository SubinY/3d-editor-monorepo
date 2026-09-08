/**
 * 行业/通用扩展壳：procedural 盒壳 + GLB 屏体。
 * procedural id 与历史 enclosure 枚举字面量一致，供 Host 下拉与旧 JSON 继续使用。
 *
 * 目录：
 * - procedural/  代码拼几何（单开门 / 双开门 / 户外柜）
 * - screen-body/ 屏体 GLB
 * - utils/       GLB 适配柜体尺寸等共用工具
 */
import type { ProceduralModelResolver } from '@mh/3d-editor'
import {
  buildOpenBoxDoorEnclosure,
  buildOpenBoxDoubleDoorEnclosure,
  buildOutdoorCabinetEnclosure
} from './procedural/model'
import { buildScreenBodyEnclosure } from './screen-body'

export const ENCLOSURE_IDS = {
  openBoxDoor: 'openBoxDoor',
  openBoxDoubleDoor: 'openBoxDoubleDoor',
  outdoorCabinet: 'outdoorCabinet',
  screenBody: 'screenBody'
} as const

export type EnclosureProceduralId =
  (typeof ENCLOSURE_IDS)[keyof typeof ENCLOSURE_IDS]

/** 注入 createEditor({ procedural: { resolvers } })；不匹配时返回 null */
export const resolve: ProceduralModelResolver = async (ref, ctx) => {
  const { width, depth, height } = ctx.item.footprint
  const h = height ?? 2
  if (ref.id === ENCLOSURE_IDS.openBoxDoor) {
    return buildOpenBoxDoorEnclosure(width, h, depth)
  }
  if (ref.id === ENCLOSURE_IDS.openBoxDoubleDoor) {
    return buildOpenBoxDoubleDoorEnclosure(width, h, depth)
  }
  if (ref.id === ENCLOSURE_IDS.outdoorCabinet) {
    return buildOutdoorCabinetEnclosure(width, h, depth)
  }
  if (ref.id === ENCLOSURE_IDS.screenBody) {
    return buildScreenBodyEnclosure(ctx.THREE, width, h, depth)
  }
  return null
}

export {
  buildOpenBoxDoorEnclosure,
  buildOpenBoxDoubleDoorEnclosure,
  buildOutdoorCabinetEnclosure
} from './procedural/model'
export {
  buildScreenBodyEnclosure,
  screenBodyUrl,
  SCREEN_BODY_NATIVE_SIZE
} from './screen-body'
export { fitGltfToFootprint } from './utils/fit-gltf'
