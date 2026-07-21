export type Vector3Tuple = [number, number, number]
export type QuaternionTuple = [number, number, number, number]
export type EulerTuple = [number, number, number]
export type ColorHex = string

export type TextureWrapMode = 'clamp' | 'repeat' | 'mirror'

export interface TextureSchema {
  url?: string
  uuid?: string
  name?: string
  wrapS?: TextureWrapMode
  wrapT?: TextureWrapMode
  repeat?: [number, number]
  offset?: [number, number]
  rotation?: number
  encoding?: string
}

export interface TransformSchema {
  position: Vector3Tuple
  rotation: EulerTuple
  scale: Vector3Tuple
  quaternion?: QuaternionTuple
}

export type ObjectType = 'mesh' | 'group' | 'light' | 'camera'

export type GeometryType = 'box' | 'sphere' | 'plane' | 'cylinder' | 'buffer'

export interface GeometrySchema {
  type: GeometryType
  uuid?: string
  name?: string
  parameters?: Record<string, unknown>
  attributes?: Record<string, number[]>
  index?: number[]
}

export type MaterialType = 'standard' | 'basic' | 'physical' | 'phong'

export interface MaterialSchema {
  type: MaterialType
  uuid?: string
  name?: string
  color?: ColorHex
  metalness?: number
  roughness?: number
  transparent?: boolean
  opacity?: number
  side?: 'front' | 'back' | 'double'
  wireframe?: boolean
  maps?: Record<string, TextureSchema>
  emissive?: ColorHex
  emissiveIntensity?: number
  userData?: Record<string, unknown>
}

export interface ObjectSchema {
  id: string
  name: string
  type: ObjectType
  visible: boolean
  transform: TransformSchema
  children?: ObjectSchema[]
  geometry?: GeometrySchema
  material?: MaterialSchema | MaterialSchema[]
  castShadow?: boolean
  receiveShadow?: boolean
  userData?: Record<string, unknown>
  layer?: number
}

export type LightType = 'ambient' | 'directional' | 'point' | 'spot'

export interface LightSchema {
  id: string
  name: string
  type: LightType
  color: ColorHex
  intensity: number
  position?: Vector3Tuple
  castShadow?: boolean
  userData?: Record<string, unknown>
}

export type CameraType = 'perspective' | 'orthographic'

export interface CameraSchema {
  type: CameraType
  fov: number
  aspect: number
  near: number
  far: number
  position: Vector3Tuple
  target: Vector3Tuple
}

export interface EnvironmentSchema {
  background?: {
    type: 'color' | 'texture' | 'skybox'
    color?: ColorHex
    urls?: string[]
    intensity?: number
  }
  fog?: {
    enabled: boolean
    type: 'linear' | 'exp2'
    color: ColorHex
    near?: number
    far?: number
    density?: number
  }
  envMap?: {
    enabled: boolean
    url: string
    intensity: number
  }
}

export interface ControlsSchema {
  type: 'orbit' | 'fly' | 'firstPerson'
  enabled: boolean
  autoRotate?: boolean
  autoRotateSpeed?: number
  enableDamping?: boolean
  dampingFactor?: number
  minDistance?: number
  maxDistance?: number
  minPolarAngle?: number
  maxPolarAngle?: number
  viewPresets?: Array<{
    name: string
    position: Vector3Tuple
    target: Vector3Tuple
  }>
}

export interface PostProcessingSchema {
  enabled: boolean
  effects: Array<{
    type: 'bloom' | 'outline' | 'ssao' | 'dof' | 'fxaa'
    enabled: boolean
    [key: string]: unknown
  }>
}

export interface AnimationSchema {
  id: string
  name: string
  type: 'timeline' | 'transform' | 'morph'
  duration: number
  autoPlay: boolean
  loop: boolean
  timeScale: number
  tracks: Track[]
  markers?: { time: number; name: string; color?: ColorHex; description?: string }[]
}

export interface SceneMetadata {
  author?: string
  created?: string
  modified?: string
  description?: string
  tags?: string[]
  thumbnail?: string
}

export interface SceneSchema {
  type?: 'scene'
  id: string
  name: string
  version: string
  objects: ObjectSchema[]
  lights: LightSchema[]
  camera: CameraSchema
  environment?: EnvironmentSchema
  controls?: ControlsSchema
  renderer?: RendererOptionsSchema
  postProcessing?: PostProcessingSchema
  animations?: AnimationSchema[]
  physics?: PhysicsBodySchema[] | Record<string, unknown>
  customData?: Record<string, unknown>
  metadata?: SceneMetadata
}

export interface RendererOptionsSchema {
  antialias?: boolean
  alpha?: boolean
  logarithmicDepthBuffer?: boolean
  pixelRatio?: number
}

export type ControlMode = 'translate' | 'rotate' | 'scale'

export interface HistorySnapshot {
  id: string
  timestamp: number
  type: 'scene' | 'object' | 'property'
  action: 'create' | 'delete' | 'modify'
  description: string
  before: unknown
  after: unknown
  preview?: string
}

export interface HistoryOptions {
  maxSize?: number
  enableCompression?: boolean
  enablePreview?: boolean
}

export interface Keyframe {
  time: number
  value: unknown
  interpolation?: 'linear' | 'smooth' | 'step' | 'bezier'
  easing?: string
}

export interface Track {
  id: string
  name: string
  targetId: string
  property: string
  type: 'number' | 'vector3' | 'color' | 'quaternion'
  keyframes: Keyframe[]
  enabled: boolean
  locked: boolean
}

export interface TimelineSchema {
  id: string
  name: string
  duration: number
  tracks: Track[]
  markers?: { time: number; name: string; color?: string; description?: string }[]
  autoPlay?: boolean
  loop?: boolean
}

export type PhysicsShapeType = 'box' | 'sphere' | 'capsule' | 'cylinder' | 'plane' | 'convex' | 'mesh'

export interface PhysicsBodySchema {
  shape: PhysicsShapeType
  mass: number
  friction: number
  restitution: number
  isKinematic: boolean
  isTrigger: boolean
  collisionLayer: number
  collisionMask: number
}

export interface EditorEvent {
  type: string
  data?: unknown
  timestamp: number
}
