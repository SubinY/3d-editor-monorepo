/**
 * 行业/通用扩展壳：单开门、双开门、户外柜。
 * procedural id 与历史 enclosure 枚举字面量一致，供 Host 下拉与旧 JSON 继续使用。
 */
import type { ProceduralModelResolver } from '@mh/3d-editor'
import {
  buildOpenBoxDoorEnclosure,
  buildOpenBoxDoubleDoorEnclosure,
  buildOutdoorCabinetEnclosure
} from './model'

export const ENCLOSURE_IDS = {
  openBoxDoor: 'openBoxDoor',
  openBoxDoubleDoor: 'openBoxDoubleDoor',
  outdoorCabinet: 'outdoorCabinet'
} as const

export type EnclosureProceduralId =
  (typeof ENCLOSURE_IDS)[keyof typeof ENCLOSURE_IDS]

/** 注入 createEditor({ procedural: { resolvers } })；不匹配时返回 null */
export const resolve: ProceduralModelResolver = (ref, ctx) => {
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
  return null
}

export {
  buildOpenBoxDoorEnclosure,
  buildOpenBoxDoubleDoorEnclosure,
  buildOutdoorCabinetEnclosure
} from './model'
