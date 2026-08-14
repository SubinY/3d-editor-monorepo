/** 通用地板 / 墙体纹理预设（相对 Host public 的路径；同源静态资源） */

export type FloorPresetId = 'none' | 'laminate' | 'granite' | 'square'

export interface FloorPreset {
  id: FloorPresetId
  label: string
  /** 相对 public 的路径；纯色无 mapUrl */
  mapUrl?: string
}

export const FLOOR_PRESETS: readonly FloorPreset[] = [
  { id: 'none', label: '纯色' },
  {
    id: 'laminate',
    label: '复合木地板',
    mapUrl: '/textures/floor/laminate_floor_02_diff_1k.jpg'
  },
  {
    id: 'granite',
    label: '花岗岩',
    mapUrl: '/textures/floor/granite_tile_diff_1k.jpg'
  },
  {
    id: 'square',
    label: '方砖',
    mapUrl: '/textures/floor/square_floor_diff_1k.jpg'
  }
] as const

/** 天花可与地板共用同一套 albedo 预设 */
export const CEILING_PRESETS = FLOOR_PRESETS

export function resolveFloorPreset(id: string | undefined): FloorPreset {
  return FLOOR_PRESETS.find(p => p.id === id) ?? FLOOR_PRESETS[0]
}

export function resolveCeilingPreset(id: string | undefined): FloorPreset {
  return resolveFloorPreset(id)
}

export type WallPresetId = 'none' | 'corrugated' | 'rusty'

export interface WallPreset {
  id: WallPresetId
  label: string
  mapUrl?: string
}

export const WALL_PRESETS: readonly WallPreset[] = [
  { id: 'none', label: '纯色' },
  {
    id: 'corrugated',
    label: '波纹铁皮',
    mapUrl: '/textures/wall/corrugated_iron_02_diff_1k.jpg'
  },
  {
    id: 'rusty',
    label: '锈蚀金属',
    mapUrl: '/textures/wall/rusty_metal_04_diff_1k.jpg'
  }
] as const

export function resolveWallPreset(id: string | undefined): WallPreset {
  return WALL_PRESETS.find(p => p.id === id) ?? WALL_PRESETS[0]
}
