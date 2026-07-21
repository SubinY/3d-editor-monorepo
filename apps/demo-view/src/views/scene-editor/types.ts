export type TransformMode = 'translate' | 'rotate' | 'scale'

export interface TreeNodeData {
  id: string
  name: string
  type: string
  visible: boolean
  children: TreeNodeData[]
}
