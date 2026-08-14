/**
 * 通用 procedural 资产入口。
 * Host: `import { panel, glowRing, alertBox, FLOOR_PRESETS, commonProceduralResolvers } from '@mh/3d-editor-assets/common'`
 * 各模型 API / 类型见对应子目录（如 `./panel`），勿在此堆积类型再导出。
 */
export * as panel from './panel'
export * as glowRing from './glow-ring'
export * as alertBox from './alert-box'
export {
  FLOOR_PRESETS,
  CEILING_PRESETS,
  WALL_PRESETS,
  resolveFloorPreset,
  resolveCeilingPreset,
  resolveWallPreset
} from './surface-presets'
export type {
  FloorPreset,
  FloorPresetId,
  WallPreset,
  WallPresetId
} from './surface-presets'

import type { ProceduralModelResolver } from '@mh/3d-editor'
import * as panelNs from './panel'
import * as glowRingNs from './glow-ring'
import * as alertBoxNs from './alert-box'

/** 通用资产 resolve 链；Host 可 `resolvers: [...commonProceduralResolvers, ...hostOnly]` */
export const commonProceduralResolvers: ProceduralModelResolver[] = [
  panelNs.resolve,
  glowRingNs.resolve,
  alertBoxNs.resolve
]
