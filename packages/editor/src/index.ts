// @3d-editor/editor —— 对外唯一必选包
// 推荐入口：createEditor；EditorDocumentJSON 由 Host 落库。

export { createEditor } from './core/create-editor'
export { createMemoryCatalog } from './catalog/MemoryCatalog'
export { buildPublishBundle, createPackCatalog } from './catalog/publish'
export { CATALOG_ITEM_MIME } from './viewport/canvas2d/types'
export { SCHEMA_VERSION } from './document/types'
export {
  createDefaultEnvironment,
  createDefaultWall,
  cloneEnvironment
} from './document/defaults'
export { createEmptyDocumentJSON } from './document/serialize'
export { isDocumentItem } from './catalog/types'
/** AI / 管理页裸预览：按 url 加载 procedural ESM（日常 Host 走 createEditor.procedural） */
export { instantiateProceduralModule } from './viewport/three/services/procedural-module-loader'

export type {
  CreateEditorOptions,
  EditorSession,
  EditorInteractionOptions,
  EditorInteractionState,
  TransformMode
} from './core/types'
export type {
  DocumentKind,
  BoundsJSON,
  WallJSON,
  TransformJSON,
  CatalogRefJSON,
  EditorNodeJSON,
  EditorDocumentJSON,
  EnvironmentJSON,
  BackgroundJSON,
  LightJSON,
  EnvironmentHelpersJSON,
  EnvironmentFloorJSON,
  EnvironmentWallJSON,
  FloorCoverage,
  DefaultViewJSON,
  CameraViewType,
  VisualState
} from './document/types'
export type { EditorDocument, PlaceResult, PlaceOptions } from './document/EditorDocument'
export type {
  CatalogItem,
  CatalogCategory,
  CatalogProvider,
  CatalogQuery,
  FootprintSpec,
  Model3DSpec,
  ProceduralModelRef,
  ProceduralResolveContext,
  ProceduralModelResolver
} from './catalog/types'
export type { PublishBundle } from './catalog/publish'
export type { Tool2D, Viewport2DOptions } from './viewport/canvas2d/types'
export type { Viewport2D } from './viewport/canvas2d/Viewport2D'
export type {
  Viewport3D,
  Viewport3DOptions,
  FocusCameraOptions
} from './viewport/three/Viewport3D'
export type { ProceduralCreateFn } from './viewport/three/services/procedural-module-loader'
export type {
  InteractionEventType,
  NodeInteractionEvent,
  NodeInteractionHandler
} from './viewport/interaction-events'
