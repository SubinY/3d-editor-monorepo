/** Host 内置地板纹理预设（同源静态资源，适配局域网）
 * 贴图来源 Poly Haven：仅使用 *_diff_1k.jpg（albedo）
 */

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

export function resolveFloorPreset(id: string | undefined): FloorPreset {
  return FLOOR_PRESETS.find(p => p.id === id) ?? FLOOR_PRESETS[0]
}
