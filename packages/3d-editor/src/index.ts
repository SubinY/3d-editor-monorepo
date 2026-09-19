// @mh/3d-editor ?? ???????
// ?????createEditor?EditorDocumentJSON ? Host ???

export { createEditor } from './core/create-editor'
export { createMemoryCatalog } from './catalog/MemoryCatalog'
export { buildPublishBundle, createPackCatalog } from './catalog/publish'
export { CATALOG_ITEM_MIME } from './viewport/canvas2d/types'
export { SCHEMA_VERSION } from './document/types'
export {
  createDefaultEnvironment,
  createDefaultFloor,
  createDefaultCeiling,
  createDefaultWall,
  createDefaultWorkspace,
  cloneEnvironment,
  cloneWorkspace
} from './document/defaults'
export {
  resolveWallAppearance,
  wallAppearanceCacheKey
} from './document/resolve-wall-appearance'
export { createEmptyDocumentJSON } from './document/serialize'
export { createId, randomUUID } from './utils/id'
export { isDocumentItem } from './catalog/types'
export { MH_ASSET_HANDLE_KEY, getAssetHandle } from './catalog/asset-handle'
export { runProceduralResolvers } from './catalog/run-procedural-resolvers'
/** AI / 远程 procedural ESM；Host 也可走 createEditor.procedural */
export { instantiateProceduralModule } from './viewport/three/services/procedural-module-loader'
export { createIndoorDefaultView } from './viewport/three/utils/indoor-view'
export { createFrontDefaultView } from './viewport/three/utils/look'

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
  WorkspaceJSON,
  TransformJSON,
  CatalogRefJSON,
  EditorNodeJSON,
  EditorDocumentJSON,
  EnvironmentJSON,
  BackgroundJSON,
  LightJSON,
  EnvironmentHelpersJSON,
  EnvironmentFloorJSON,
  EnvironmentCeilingJSON,
  EnvironmentWallJSON,
  DefaultViewJSON,
  CameraViewType,
  VisualState
} from './document/types'
export type { ResolvedWallAppearance } from './document/resolve-wall-appearance'
export type {
  EditorDocument,
  PlaceResult,
  PlaceOptions,
  DuplicateOptions
} from './document/EditorDocument'
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
export type { AssetHandle } from './catalog/asset-handle'
export type { PublishBundle } from './catalog/publish'
export type {
  Tool2D,
  Viewport2DOptions,
  PickCandidatesEvent,
  PickCandidatesHandler
} from './viewport/canvas2d/types'
export type { Viewport2D } from './viewport/canvas2d/Viewport2D'
export type { Viewport3D, Viewport3DOptions } from './viewport/three/Viewport3D'
export type {
  CameraLookTarget,
  CameraLookOptions,
  CaptureSnapshopOptions
} from './viewport/three/types'
export type { ProceduralCreateFn } from './viewport/three/services/procedural-module-loader'
export type {
  InteractionEventType,
  NodeInteractionEvent,
  NodeInteractionHandler
} from './viewport/interaction-events'
