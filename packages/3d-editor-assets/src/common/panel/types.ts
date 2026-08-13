/** 信息面板数据合同 */

export const PROCEDURAL_ID = 'info-panel'

export type PanelElementType = 'text' | 'image'

export interface PanelTextElement {
  id: string
  type: 'text'
  name?: string
  left: number
  top: number
  width: number
  height: number
  text: string
  color?: string
  fontSize?: number
  fontWeight?: number | string
  fontFamily?: string
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  background?: string
}

export interface PanelImageElement {
  id: string
  type: 'image'
  name?: string
  left: number
  top: number
  width: number
  height: number
  url: string
  opacity?: number
}

export type PanelElement = PanelTextElement | PanelImageElement

export interface PanelContentJSON {
  width: number
  height: number
  background?: string
  backgroundImage?: string
  elements: PanelElement[]
  /** 世界空间宽（米） */
  worldWidth?: number
}

export interface PanelHandle {
  root: import('three').Object3D
  sprite: import('three').Sprite
  apply: (content: PanelContentJSON) => Promise<void>
  dispose: () => void
}
