/** Host 内置地板/天花纹理预设（同源静态资源） */

export type SurfacePresetId = 'none' | 'laminate' | 'granite' | 'square'

export interface SurfacePreset {
  id: SurfacePresetId
  label: string
  mapUrl?: string
}

export const FLOOR_PRESETS: readonly SurfacePreset[] = [
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

export const CEILING_PRESETS = FLOOR_PRESETS

export function resolveFloorPreset(id: string | undefined): SurfacePreset {
  return FLOOR_PRESETS.find(p => p.id === id) ?? FLOOR_PRESETS[0]
}

export function resolveCeilingPreset(id: string | undefined): SurfacePreset {
  return resolveFloorPreset(id)
}
