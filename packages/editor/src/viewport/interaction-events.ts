import type { EditorNodeJSON } from '../document/types'

/** 3D 视口指针交互事件 */
export type InteractionEventType = 'click' | 'dblclick' | 'longpress' | 'hover'

export interface NodeInteractionEvent {
  type: InteractionEventType
  /** 路径寻址：顶层为 nodeId；嵌套为 parentId/childId */
  nodePath: string
  /** path 首段 */
  nodeId: string
  node?: EditorNodeJSON
  pointer: { x: number; y: number; button: number }
  originalEvent: PointerEvent | MouseEvent
}

export type NodeInteractionHandler = (event: NodeInteractionEvent) => void
