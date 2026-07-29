/**
 * EditorDocumentJSON —— 跨团队存盘与交换的主格式（schema 合同）。
 * 与行业无关：只描述「边界 + 线段墙 + 节点引用与变换 + 3D 呈现环境」。
 */

export const SCHEMA_VERSION = '1.0.0'

export type DocumentKind = 'scene' | 'container'

export interface BoundsJSON {
  width: number
  depth: number
  /** container 常用（箱体净高）；scene 可选净高 */
  height?: number
}

/** 线段墙（定稿 D4）：矩形房间 = 四段墙的快捷创建 */
export interface WallJSON {
  id: string
  /** 俯视 XZ 起点 */
  a: [number, number]
  /** 俯视 XZ 终点 */
  b: [number, number]
  height?: number
  thickness?: number
}

export interface TransformJSON {
  /**
   * 世界坐标：y 向上。
   * - scene 2D：主要改 x/z（俯视）
   * - container 2D：主要改 x/y（立面：宽×高；y=物件底边离地高度）
   */
  position: [number, number, number]
  /** euler (rad) */
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface CatalogRefJSON {
  id: string
  version: string
}

export interface EditorNodeJSON {
  id: string
  name?: string
  /** 外置资产引用（不 bake mesh 几何）；条目为 document 型时 3D 视图嵌套解析（D2） */
  catalogRef?: CatalogRefJSON
  transform: TransformJSON
  visible?: boolean
  children?: EditorNodeJSON[]
  /** 业务扩展字段，编辑器不解释 */
  props?: Record<string, unknown>
}

/** 3D 背景：纯色或等距柱状全景/HDR URL */
export type BackgroundJSON =
  | { type: 'color'; value: string }
  | { type: 'equirect'; url: string }

export interface LightJSON {
  type: 'ambient' | 'directional'
  color?: string
  intensity?: number
  /** directional：世界坐标位置 */
  position?: [number, number, number]
  castShadow?: boolean
}

export interface EnvironmentHelpersJSON {
  grid: boolean
  /**
   * 编辑态空间壳（不可选中）：
   * - none：无壳
   * - openBox：五面开口盒（缺 +Z）
   * - openBoxDoor：五面开口盒 + 单扇外开前柜门
   * - openBoxDoubleDoor：五面开口盒 + 双扇对开前柜门
   * - outdoorCabinet：户外双门柜（坡顶 + 底通气 + 铆钉锁扣，双门外开）
   */
  enclosure:
    | 'none'
    | 'openBox'
    | 'openBoxDoor'
    | 'openBoxDoubleDoor'
    | 'outdoorCabinet'
}

/** 地面铺设范围 */
export type FloorCoverage = 'bounds' | 'closedRooms'

/**
 * 场景级地面（单套材质）。
 * - bounds：工作区矩形场地 + 可选闭合墙内叠层
 * - closedRooms：仅闭合墙围合区（不规则跟随墙环）
 * presetId 由 Host 解释；内核只加载 mapUrl
 */
export interface EnvironmentFloorJSON {
  visible: boolean
  coverage: FloorCoverage
  color: string
  opacity?: number
  presetId?: string
  /** 推荐同源相对路径，如 /textures/floor/concrete.webp */
  mapUrl?: string
  /** 贴图世界重复尺度（米/格），默认 4 */
  mapRepeat?: number
}

/**
 * 场景级墙体外观（所有墙共用一套材质）。
 * presetId 由 Host 解释；内核只加载 mapUrl
 */
export interface EnvironmentWallJSON {
  color: string
  opacity?: number
  presetId?: string
  /** 推荐同源相对路径，如 /textures/wall/plaster_diff_1k.jpg */
  mapUrl?: string
  /** 贴图世界重复尺度（米/格），默认 2 */
  mapRepeat?: number
}

/** 3D 相机交互模式（对齐常见组态：旋转相机 / 正交平面图） */
export type CameraViewType = 'orbit' | 'orthographic'

/**
 * 默认/预览视角种子（非 Orbit 运行时位姿）。
 * 半径 = ‖position − target‖，不单独存盘。
 */
export interface DefaultViewJSON {
  /** orbit：透视 + 可旋转；orthographic：正交 + 禁旋转（平面图） */
  type?: CameraViewType
  /** 相机位置（世界坐标） */
  position: [number, number, number]
  /** 注视点 / 轨道圆心 */
  target: [number, number, number]
  /** orbit：垂直视野角(°)；orthographic：视窗高度（米） */
  fov?: number
  /** 允许靠近目标的最小距离（米） */
  minDistance?: number
  /** 允许远离目标的最大距离（米） */
  maxDistance?: number
}

/** Document 级 3D 呈现配置（内核可解释并投影） */
export interface EnvironmentJSON {
  background: BackgroundJSON
  lights: LightJSON[]
  shadows: { enabled: boolean; type?: 'basic' | 'pcfsoft' }
  helpers: EnvironmentHelpersJSON
  /** 场景地面；container 默认 visible=false */
  floor: EnvironmentFloorJSON
  /** 场景墙体外观；所有墙共用 */
  wall: EnvironmentWallJSON
  /** 默认视角：类型 / 目标 / 位姿 / 视场 / 距离限制；编辑态 Orbit 可静默回写目标与半径 */
  defaultView?: DefaultViewJSON
}

export interface EditorDocumentJSON {
  /** 开发期字段戳；不做按版本分支或迁移 */
  schemaVersion: string
  kind: DocumentKind
  id: string
  name: string
  /** 常量：当前仅米制 */
  unit: 'm'
  bounds: BoundsJSON
  structure?: {
    walls?: WallJSON[]
  }
  nodes: EditorNodeJSON[]
  /** 3D 呈现：背景 / 灯 / 阴影 / 辅助体 / 默认视角 */
  environment: EnvironmentJSON
  /** 非契约扩展；编辑相机等工作区状态不入资产契约 */
  metadata?: Record<string, unknown>
}

/** 运行时可视呈现；不含业务状态枚举（色值由 Host 传入） */
export interface VisualState {
  /** 发光色；省略或 null = 还原材质 */
  color?: string | null
  /** 0–1，仅在有 color 时生效，默认 1 */
  intensity?: number
}

export function createDefaultTransform(): TransformJSON {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  }
}

export function cloneTransform(t: TransformJSON): TransformJSON {
  return {
    position: [...t.position],
    rotation: [...t.rotation],
    scale: [...t.scale]
  }
}

/** 按拓扑写出完整默认 environment */
export function createDefaultEnvironment(kind: DocumentKind, bounds: BoundsJSON): EnvironmentJSON {
  const { width, depth, height } = bounds
  const h = height ?? (kind === 'container' ? 2 : Math.max(width, depth) * 0.5)

  const lights: LightJSON[] =
    kind === 'container'
      ? [
        { type: 'ambient', color: '#ffffff', intensity: 0.75 },
        {
          type: 'directional',
          color: '#ffffff',
          intensity: 1.4,
          position: [width * 0.4, h * 1.2, depth * 1.5],
          castShadow: true
        }
      ]
      : [
        { type: 'ambient', color: '#ffffff', intensity: 0.75 },
        {
          type: 'directional',
          color: '#ffffff',
          intensity: 1.4,
          position: [
            width * 0.6,
            Math.max(h, Math.max(width, depth)) * 0.9,
            depth * 0.6
          ],
          castShadow: true
        }
      ]

  const defaultView: DefaultViewJSON =
    kind === 'container'
      ? {
        type: 'orbit',
        position: [0, h * 0.45, Math.max(depth, 0.6) * 8],
        target: [0, h * 0.45, 0],
        fov: 50,
        minDistance: 0.2,
        maxDistance: 200
      }
      : (() => {
        const d = Math.max(width, depth, 4)
        return {
          type: 'orbit' as const,
          position: [d * 0.65, d * 0.6, d * 0.95] as [number, number, number],
          target: [0, 0, 0] as [number, number, number],
          fov: 50,
          minDistance: 1,
          maxDistance: 500
        }
      })()

  const floor: EnvironmentFloorJSON = createDefaultFloor(kind)
  const wall: EnvironmentWallJSON = createDefaultWall()

  return {
    background: { type: 'color', value: '#0c1420' },
    lights,
    shadows: { enabled: true, type: 'pcfsoft' },
    helpers: {
      grid: kind === 'scene',
      enclosure: kind === 'container' ? 'openBoxDoor' : 'none'
    },
    floor,
    wall,
    defaultView
  }
}

/** 缺省地面（createEmpty / createDefaultEnvironment） */
export function createDefaultFloor(kind: DocumentKind = 'scene'): EnvironmentFloorJSON {
  return kind === 'container'
    ? {
        visible: false,
        coverage: 'bounds',
        color: '#1a3048',
        opacity: 1,
        presetId: 'none'
      }
    : {
        visible: true,
        coverage: 'bounds',
        color: '#1a3048',
        opacity: 1,
        presetId: 'none'
      }
}

/** 缺省墙体外观 */
export function createDefaultWall(): EnvironmentWallJSON {
  return {
    color: '#233242',
    opacity: 0.92,
    presetId: 'none'
  }
}

export function cloneEnvironment(env: EnvironmentJSON): EnvironmentJSON {
  return JSON.parse(JSON.stringify(env)) as EnvironmentJSON
}
