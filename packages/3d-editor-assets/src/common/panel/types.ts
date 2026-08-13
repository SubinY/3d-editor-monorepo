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
  /** 0–1，默认 1 */
  opacity?: number
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

/** 面板背景图填充：原始大小 / 拉伸 / 覆盖 / 包含 */
export type PanelBackgroundImageFit = 'original' | 'stretch' | 'cover' | 'contain'

/**
 * 广告牌朝向（仅信息面板，资产内 onBeforeRender，不改内核）：
 * - none：不跟随相机
 * - yaw：水平绕 Y 面向相机（默认）
 * - full：完全面向相机（原 Sprite 效果）
 */
export type PanelBillboardMode = 'none' | 'yaw' | 'full'

export interface PanelContentJSON {
  width: number
  height: number
  /** 纯色背景；transparent 表示透明 */
  background?: string
  backgroundImage?: string
  /** 资源展示名（Host UI） */
  backgroundImageName?: string
  backgroundImageFit?: PanelBackgroundImageFit
  elements: PanelElement[]
  /** 世界空间宽（米） */
  worldWidth?: number
  /** 广告牌模式，默认 yaw */
  billboard?: PanelBillboardMode
}

export interface PanelHandle {
  root: import('three').Object3D
  /** 显示平面（历史字段名 sprite，现为 Mesh） */
  sprite: import('three').Object3D
  apply: (content: PanelContentJSON) => Promise<void>
  dispose: () => void
}
