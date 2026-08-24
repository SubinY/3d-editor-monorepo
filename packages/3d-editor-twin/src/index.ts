/**
 * @mh/3d-editor-twin — 可选孪生绑定层（非内核、非只读播放器）。
 *
 * 编辑态：readTwin / writeTwin / emptyTwin
 * 预览态：TwinPlayer + DataSource（Http / Ws / Mqtt，见 createDataSource）
 */

export type {
  ConditionOp,
  TwinPoint,
  TwinRuleWhen,
  TwinRuleThen,
  TwinRule,
  TwinProps,
  PointValue,
  PointSample,
  DataSourceNeed,
  DataSource,
  TwinViewport,
  TwinDocumentNode,
  TwinDocument,
  TwinTarget
} from './types'

export {
  emptyTwin,
  createTwinPoint,
  createTwinRule,
  readTwin,
  resolveTwinId,
  writeTwin
} from './twin-props'

export {
  PointValueStore,
  compareCondition,
  DEFAULT_HIGHLIGHT_RANK,
  defaultRankHighlight,
  evaluateHighlight,
  evaluateHighlightHit
} from './evaluate'
export type { HighlightHit, PointValueMap } from './evaluate'

export {
  createCompositeDataSource,
  createCompositeDataSourceFromConfigs,
  createDataSource,
  HttpDataSource,
  MqttDataSource,
  WsDataSource,
  parseSamplesJson,
  parseSamplesPayload,
  resolveSamples,
  resolveSamplesJson
} from './data-source'
export type {
  DataSourceConfig,
  HttpSourceConfig,
  MapResponseFn,
  MqttSourceConfig,
  SubscribeMessage,
  TwinSamplesPayload,
  WsSourceConfig
} from './data-source'

export { TwinPlayer, collectTwinTargets, collectUsedSourceIds } from './twin-player'
export type { ResolveNested, TwinPlayerOptions, VisualStateLike } from './twin-player'
