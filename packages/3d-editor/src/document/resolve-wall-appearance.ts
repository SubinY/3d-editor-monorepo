import type { BoundsJSON, EnvironmentWallJSON, WallJSON } from './types'

/** 合并后的墙外观（局部优先于全局） */
export interface ResolvedWallAppearance {
  height: number
  thickness: number
  color: string
  opacity: number
  presetId?: string
  mapUrl?: string
  mapRepeat: number
  cornerOverlap: boolean
}

const DEFAULT_HEIGHT = 3
const DEFAULT_THICKNESS = 0.2

export function resolveWallAppearance(
  wall: WallJSON,
  envWall: EnvironmentWallJSON | undefined,
  bounds?: BoundsJSON
): ResolvedWallAppearance {
  const global = envWall
  return {
    height:
      wall.height ??
      global?.defaultHeight ??
      bounds?.height ??
      DEFAULT_HEIGHT,
    thickness: wall.thickness ?? global?.defaultThickness ?? DEFAULT_THICKNESS,
    color: wall.color ?? global?.color ?? '#233242',
    opacity: wall.opacity ?? global?.opacity ?? 1,
    presetId: wall.presetId ?? global?.presetId,
    mapUrl: wall.mapUrl ?? global?.mapUrl,
    mapRepeat: wall.mapRepeat ?? global?.mapRepeat ?? 2,
    cornerOverlap: global?.cornerOverlap ?? false
  }
}

/** 材质缓存 key（不含几何） */
export function wallAppearanceCacheKey(resolved: ResolvedWallAppearance): string {
  return [
    resolved.color,
    resolved.opacity,
    resolved.presetId ?? '',
    resolved.mapUrl ?? '',
    resolved.mapRepeat,
    resolved.cornerOverlap ? '1' : '0'
  ].join('|')
}
