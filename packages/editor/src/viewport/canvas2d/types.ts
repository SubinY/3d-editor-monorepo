import type { CatalogProvider } from '../../catalog/types'
import type { EditorDocument, PlaceResult } from '../../document/EditorDocument'
import type { WallJSON } from '../../document/types'

export type Tool2D = 'select' | 'wall'

/** HTML5 拖放的 dataTransfer 键：值为 JSON.stringify(CatalogItem) */
export const CATALOG_ITEM_MIME = 'application/x-catalog-item'

export interface Theme2D {
  background: string
  grid: string
  gridMajor: string
  bounds: string
  floor: string
  wall: string
  wallSelected: string
  node: string
  nodeSelected: string
  nodeDenied: string
  label: string
  dimension: string
  guide: string
}

export const DEFAULT_THEME: Theme2D = {
  background: '#0d1420',
  grid: '#161f2d',
  gridMajor: '#1d2939',
  bounds: '#2ea8ff',
  floor: '#1a3048',
  wall: '#9db4c8',
  wallSelected: '#39d2ff',
  node: '#3f7fbf',
  nodeSelected: '#39d2ff',
  nodeDenied: '#ff5a5a',
  label: '#c7d3e0',
  dimension: '#7ea4c4',
  guide: '#39d2ff'
}

/** 平面坐标：scene=XZ 俯视；container=XY 立面 */
export interface PlanePoint {
  u: number
  v: number
}

export interface Viewport2DOptions {
  document: EditorDocument
  catalog?: CatalogProvider
  readonly?: boolean
  theme?: Partial<Theme2D>
  /** 会话级节点对齐吸附；画墙端点吸附不受此开关影响 */
  snapEnabled?: boolean
  onDenied?: (reason: string) => void
  onPlaceResult?: (result: PlaceResult) => void
  onWallSelect?: (wall: WallJSON) => void
}

export const WALL_POINT_SNAP = 0.1
export const ENDPOINT_SNAP = 0.35
export const FIXTURE_SNAP = 0.8
