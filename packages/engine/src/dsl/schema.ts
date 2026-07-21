import type {
  AnimationSchema,
  ControlsSchema,
  EnvironmentSchema,
  PostProcessingSchema,
  RendererOptionsSchema,
  SceneSchema,
} from '../types'

// 扩展 SceneSchema
export interface ExtendedSceneSchema {
  $schema?: string
  version: string
  type: 'scene'
  id: string
  name: string
  metadata?: SceneSchema['metadata']
  environment?: EnvironmentSchema
  controls?: ControlsSchema
  renderer?: RendererOptionsSchema
  postProcessing?: PostProcessingSchema
  objects: SceneSchema['objects']
  lights: SceneSchema['lights']
  animations?: AnimationSchema[]
  physics?: SceneSchema['physics']
  customData?: SceneSchema['customData']
}

