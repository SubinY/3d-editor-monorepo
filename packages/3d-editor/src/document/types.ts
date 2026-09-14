/**
 * EditorDocumentJSON —— 跨团队存盘与交换的主格式（schema 合同）。
 * 与行业无关：只描述「边界 + 线段墙 + 工作区 + 节点引用与变换 + 3D 呈现环境」。
 */

export const SCHEMA_VERSION = '1.0.0'

export type DocumentKind = 'scene' | 'container'

export interface BoundsJSON {
  width: number
  depth: number
  /** container（XY 立面容器）常用净高；scene 可选净高（AABB / 回退） */
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
  /** 以下为局部外观；未设字段回落 environment.wall */
  color?: string
  opacity?: number
  presetId?: string
  mapUrl?: string
  mapRepeat?: number
}

/**
 * 场景工作区（多边形）。
 * 地面 / 天花铺设范围 = outline；仅 scene 使用。
 */
export interface WorkspaceJSON {
  id: string
  name?: string
  /** 俯视 XZ，≥3，隐式闭合 */
  outline: [number, number][]
  /** 该区天花高度（Y）；缺省回退 bounds.height ?? 3 */
  height?: number
  floor: EnvironmentFloorJSON
  ceiling: EnvironmentCeilingJSON
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
   * 编辑态空间壳（不可选中）。开放字符串：
   * - none：无壳
   * - openBox：内核内建五面开口盒（缺 +Z 前脸）
   * - 其它任意 id：由 Host / assets procedural resolver 解释（如 openBoxDoor）
   */
  enclosure: string
}

/**
 * 工作区地面材质（铺设范围 = 所属 workspace.outline）。
 * presetId 由 Host 解释；内核只加载 mapUrl。
 */
export interface EnvironmentFloorJSON {
  visible: boolean
  color: string
  opacity?: number
  presetId?: string
  /** 推荐同源相对路径，如 /textures/floor/concrete.webp */
  mapUrl?: string
  /** 贴图世界重复尺度（米/格），默认 4 */
  mapRepeat?: number
}

/** 工作区天花（与 EnvironmentFloorJSON 同形）；网格平面 Y = workspace.height */
export type EnvironmentCeilingJSON = EnvironmentFloorJSON

/**
 * 场景级墙体默认外观（局部 WallJSON 字段优先覆盖）。
 * presetId 由 Host 解释；内核只加载 mapUrl。
 */
export interface EnvironmentWallJSON {
  color: string
  opacity?: number
  presetId?: string
  /** 推荐同源相对路径，如 /textures/wall/plaster_diff_1k.jpg */
  mapUrl?: string
  /** 贴图世界重复尺度（米/格），默认 2 */
  mapRepeat?: number
  /** 新建墙 / 未设局部 height 时的默认净高 */
  defaultHeight?: number
  /** 新建墙 / 未设局部 thickness 时的默认厚度 */
  defaultThickness?: number
  /**
   * true：墙段按全长建盒，拐角体积相交；
   * false / 缺省：两端各收半个厚度对接（减轻 z-fight）
   */
  cornerOverlap?: boolean
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
  /** 场景墙体默认外观（仅 XZ scene 有墙）；局部 WallJSON 优先 */
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
    /** 仅 scene；container 忽略 */
    workspaces?: WorkspaceJSON[]
  }
  nodes: EditorNodeJSON[]
  /** 3D 呈现：背景 / 灯 / 阴影 / 辅助体 / 默认视角 / 墙默认 */
  environment: EnvironmentJSON
  /** 业务扩展字段，编辑器不解释 */
  props?: Record<string, unknown>
}

/** 运行时可视呈现；不含业务状态枚举（色值由 Host 传入） */
export interface VisualState {
  /** 本体高亮色；省略或 null = 还原材质（含贴图） */
  color?: string | null
  /** 0–1，仅在有 color 时生效，默认 1；驱动 emissive 强弱 */
  intensity?: number
  /** 在渲染循环内按 sine 脉冲 intensity（故障闪烁）；需同时有 color */
  pulse?: boolean
  /** 脉冲频率 Hz；默认 1.2 */
  pulseHz?: number
}
