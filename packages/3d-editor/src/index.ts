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
  cloneEnvironment
} from './document/defaults'
export { createEmptyDocumentJSON } from './document/serialize'
export { isDocumentItem } from './catalog/types'
/** AI / ???????? url ?? procedural ESM??? Host ? createEditor.procedural? */
export { instantiateProceduralModule } from './viewport/three/services/procedural-module-loader'
export { createIndoorDefaultView } from './viewport/three/utils/indoor-view'

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
  EnvironmentCeilingJSON,
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
  FocusCameraOptions,
  EnterIndoorViewOptions
} from './viewport/three/Viewport3D'
export type { ProceduralCreateFn } from './viewport/three/services/procedural-module-loader'
export type {
  InteractionEventType,
  NodeInteractionEvent,
  NodeInteractionHandler
} from './viewport/interaction-events'
