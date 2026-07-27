// @3d-editor/editor —— 对外唯一必选包
// 推荐入口：createEditor；EditorDocumentJSON 由 Host 落库。

export { createEditor } from './core/create-editor'
export { createMemoryCatalog, MemoryCatalog } from './catalog/MemoryCatalog'
export { CATALOG_ITEM_MIME } from './viewport/canvas2d/types'
export { SCHEMA_VERSION, createDefaultTransform, cloneTransform, createDefaultEnvironment, cloneEnvironment } from './document/types'
export { createEmptyDocumentJSON } from './document/serialize'
export { isDocumentItem, catalogKey } from './catalog/types'

export type { CreateEditorOptions, EditorSession, EditorInteractionOptions, EditorInteractionState, TransformMode } from './core/types'
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
  DefaultViewJSON,
  CameraViewType,
  VisualState
} from './document/types'
export type { CreateDocumentOptions, EditorDocument, PlaceResult, PlaceOptions } from './document/EditorDocument'
export type {
  CatalogItem,
  CatalogCategory,
  CatalogProvider,
  CatalogQuery,
  FootprintSpec,
  Model3DSpec
} from './catalog/types'
export type { Tool2D, Viewport2DOptions } from './viewport/canvas2d/types'
export type { Viewport2D } from './viewport/canvas2d/Viewport2D'
export type { Viewport3D, Viewport3DOptions } from './viewport/three/Viewport3D'
