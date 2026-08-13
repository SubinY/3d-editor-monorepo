/** Host 内置墙体纹理预设（同源静态资源） */

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
