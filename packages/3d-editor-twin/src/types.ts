/** 条件比较算子 */
export type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'

export interface TwinPoint {
  key: string
  source?: string
  alias?: string
  unit?: string
}

export interface TwinRuleWhen {
  point: string
  op: ConditionOp
  value: number | string | boolean
}

/**
 * 规则命中后写入的槽位字典。
 * v1 播放器只执行 `highlight`（效果令牌字符串）；其它 key 忽略。
 */
export interface TwinRuleThen {
  slots: Record<string, unknown>
}

export interface TwinRule {
  id: string
  name?: string
  when: TwinRuleWhen
  then: TwinRuleThen
  enabled?: boolean
}

/** 落在 node.props.twin；不进 EditorDocumentJSON 一级字段 */
export interface TwinProps {
  /** 物联网主键；缺省用 node.id */
  id?: string
  points: TwinPoint[]
  rules?: TwinRule[]
}

export type PointValue = number | string | boolean

export interface PointSample {
  twinId: string
  key: string
  value: PointValue
  ts?: number
}

export interface DataSourceNeed {
  twinId: string
  key: string
  source?: string
}

export interface DataSource {
  start(need: DataSourceNeed[]): void
  stop(): void
  subscribe(onBatch: (samples: PointSample[]) => void): () => void
}

/** 视口鸭子类型：只需刷色 API */
export interface TwinViewport {
  setNodeVisualState(nodePath: string, state: { color?: string | null; intensity?: number }): void
  clearVisualStates(): void
}

/** Document 鸭子类型：读写 props */
export interface TwinDocumentNode {
  id: string
  name?: string
  props?: Record<string, unknown>
}

export interface TwinDocument {
  getNodes(): TwinDocumentNode[]
  getNode(id: string): TwinDocumentNode | undefined
  commands: {
    updateNode: (id: string, patch: { props?: Record<string, unknown> }) => unknown
  }
}

export interface TwinTarget {
  path: string
  label: string
  twinId: string
  twin: TwinProps
}
