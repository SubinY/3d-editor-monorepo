export interface PartSpec {
  id: string
  name: string
  icon: string
  color: string
  category: 'structure' | 'electrical' | 'auxiliary' | 'imported'
  kind?: 'cabinet' | 'part'
  size: [number, number, number]
  source?: 'builtin' | 'imported'
  resourceId?: string
  symbolResourceId?: string
  focusEnabled?: boolean
  footprintMm?: [number, number]
}

export type TransformMode = 'translate' | 'rotate' | 'scale'
export type AssetEditorMode = '2d' | '3d'

export interface TreeNodeData {
  id: string
  name: string
  type: string
  visible: boolean
  children: TreeNodeData[]
}

export interface Layout2DSelection {
  id: string
  componentId: string
}
