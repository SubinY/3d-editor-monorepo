import * as THREE from 'three'
import { EditorObjectPolicy } from '../policies/EditorObjectPolicy'
import type {
  CameraSchema,
  GeometrySchema,
  LightSchema,
  MaterialSchema,
  ObjectSchema,
  SceneSchema,
  TextureSchema
} from '../types'
import { serializeLight } from '../assets/LightingFactory'

const SCHEMA_VERSION = '1.0.0'

export class SceneSerializer {
  serialize(scene: THREE.Scene, camera: THREE.PerspectiveCamera, extras: Partial<SceneSchema> = {}): SceneSchema {
    const schema: SceneSchema = {
      type: 'scene',
      id: scene.uuid,
      name: scene.name || 'Scene',
      version: SCHEMA_VERSION,
      objects: scene.children
        .filter(child => EditorObjectPolicy.isSerializable(child))
        .map(child => this.serializeObject(child)),
      lights: scene.children
        .filter(child => (child as THREE.Light).isLight)
        .map(child => serializeLight(child as THREE.Light)),
      camera: this.serializeCamera(camera),
      environment: this.serializeEnvironment(scene),
      controls: extras.controls,
      renderer: extras.renderer,
      postProcessing: extras.postProcessing,
      animations: extras.animations,
      physics: extras.physics,
      customData: extras.customData ?? (scene.userData?.customData as Record<string, unknown> | undefined),
      metadata: extras.metadata ?? (scene.userData?.metadata as SceneSchema['metadata'] | undefined)
    }
    // 允许插件在序列化后补充数据
    return schema
  }

  deserialize(schema: SceneSchema): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
    const scene = new THREE.Scene()
    scene.uuid = schema.id
    scene.name = schema.name
    if (schema.metadata) scene.userData.metadata = schema.metadata
    if (schema.customData) scene.userData.customData = schema.customData

    if (schema.environment) {
      this.applyEnvironment(scene, schema.environment)
    }

    schema.objects.forEach(obj => scene.add(this.deserializeObject(obj)))
    schema.lights.forEach(light => scene.add(this.deserializeLight(light)))

    const camera = this.deserializeCamera(schema.camera)
    return { scene, camera }
  }

  private serializeObject(object: THREE.Object3D): ObjectSchema {
    const isMesh = (object as THREE.Mesh).isMesh
    const mesh = object as THREE.Mesh
    const material = isMesh ? this.serializeMaterial(mesh.material as THREE.Material | THREE.Material[]) : undefined
    const geometry = isMesh ? this.serializeGeometry(mesh.geometry as THREE.BufferGeometry) : undefined

    return {
      id: object.uuid,
      name: object.name,
      type: isMesh ? 'mesh' : 'group',
      visible: object.visible,
      transform: {
        position: object.position.toArray() as [number, number, number],
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: object.scale.toArray() as [number, number, number],
        quaternion: object.quaternion.toArray() as [number, number, number, number]
      },
      geometry,
      material,
      castShadow: (object as THREE.Mesh).castShadow ?? false,
      receiveShadow: (object as THREE.Mesh).receiveShadow ?? false,
      layer: object.layers?.mask,
      children: object.children.filter(child => this.isSerializableObject(child)).map(child => this.serializeObject(child)),
      userData: object.userData
    }
  }

  private deserializeObject(schema: ObjectSchema): THREE.Object3D {
    let obj: THREE.Object3D
    if (schema.type === 'mesh') {
      const geometry = schema.geometry ? this.deserializeGeometry(schema.geometry) : new THREE.BoxGeometry(1, 1, 1)
      const material = schema.material ? this.deserializeMaterial(schema.material) : new THREE.MeshStandardMaterial()
      obj = new THREE.Mesh(geometry, material)
      ;(obj as THREE.Mesh).castShadow = schema.castShadow ?? false
      ;(obj as THREE.Mesh).receiveShadow = schema.receiveShadow ?? false
    } else {
      obj = new THREE.Group()
    }

    obj.uuid = schema.id
    obj.name = schema.name
    obj.visible = schema.visible
    obj.position.fromArray(schema.transform.position)
    obj.rotation.set(schema.transform.rotation[0], schema.transform.rotation[1], schema.transform.rotation[2])
    if (schema.transform.quaternion) {
      obj.quaternion.fromArray(schema.transform.quaternion)
    }
    obj.scale.fromArray(schema.transform.scale)
    if (schema.layer !== undefined) {
      obj.layers.set(schema.layer)
    }
    obj.userData = schema.userData || {}
    schema.children?.forEach(child => obj.add(this.deserializeObject(child)))
    return obj
  }

  private serializeCamera(camera: THREE.PerspectiveCamera): CameraSchema {
    return {
      type: 'perspective',
      fov: camera.fov,
      aspect: camera.aspect,
      near: camera.near,
      far: camera.far,
      position: camera.position.toArray() as [number, number, number],
      target: [0, 0, 0]
    }
  }

  private deserializeCamera(schema: CameraSchema): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(schema.fov, schema.aspect, schema.near, schema.far)
    camera.position.fromArray(schema.position)
    return camera
  }

  private serializeGeometry(geometry: THREE.BufferGeometry): GeometrySchema {
    if (geometry instanceof THREE.BoxGeometry) {
      const params = geometry.parameters
      return { type: 'box', parameters: params }
    }
    if (geometry instanceof THREE.SphereGeometry) {
      const params = geometry.parameters
      return { type: 'sphere', parameters: params }
    }
    if (geometry instanceof THREE.PlaneGeometry) {
      const params = geometry.parameters
      return { type: 'plane', parameters: params }
    }
    // fallback buffer geometry
    const attributes: Record<string, number[]> = {}
    Object.keys(geometry.attributes).forEach(key => {
      const attr = geometry.attributes[key] as THREE.BufferAttribute
      attributes[key] = Array.from(attr.array as Iterable<number>)
    })
    return {
      type: 'buffer',
      attributes,
      index: geometry.index ? Array.from(geometry.index.array as Iterable<number>) : undefined
    }
  }

  private deserializeGeometry(schema: GeometrySchema): THREE.BufferGeometry {
    switch (schema.type) {
      case 'box': {
        const p = (schema.parameters as { width?: number; height?: number; depth?: number }) || { width: 1, height: 1, depth: 1 }
        return new THREE.BoxGeometry(p.width ?? 1, p.height ?? 1, p.depth ?? 1)
      }
      case 'sphere': {
        const p = (schema.parameters as { radius?: number; widthSegments?: number; heightSegments?: number }) || { radius: 1, widthSegments: 16, heightSegments: 12 }
        return new THREE.SphereGeometry(p.radius ?? 1, p.widthSegments ?? 16, p.heightSegments ?? 12)
      }
      case 'plane': {
        const p = (schema.parameters as { width?: number; height?: number }) || { width: 1, height: 1 }
        return new THREE.PlaneGeometry(p.width ?? 1, p.height ?? 1)
      }
      default: {
        const geo = new THREE.BufferGeometry()
        if (schema.attributes) {
          Object.keys(schema.attributes).forEach(key => {
            const array = new Float32Array(schema.attributes![key])
            const itemSize = key === 'normal' || key === 'position' ? 3 : 2
            geo.setAttribute(key, new THREE.BufferAttribute(array, itemSize))
          })
        }
        if (schema.index) {
          geo.setIndex(schema.index)
        }
        return geo
      }
    }
  }

  private serializeTexture(map: THREE.Texture | null | undefined): TextureSchema | undefined {
    if (!map) return undefined
    return {
      uuid: map.uuid,
      name: map.name,
      url: (map as any).source?.data?.src,
      wrapS: this.wrapToSchema(map.wrapS),
      wrapT: this.wrapToSchema(map.wrapT),
      repeat: [map.repeat.x, map.repeat.y],
      offset: [map.offset.x, map.offset.y],
      rotation: map.rotation
    }
  }

  private serializeMaterial(material: THREE.Material | THREE.Material[] | undefined): MaterialSchema | MaterialSchema[] | undefined {
    if (!material) return undefined
    if (Array.isArray(material)) {
      return material.map(mat => this.serializeMaterial(mat) as MaterialSchema)
    }
    const base: MaterialSchema = {
      type: 'standard',
      uuid: material.uuid,
      name: material.name,
      userData: material.userData
    }
    if ((material as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
      const mat = material as THREE.MeshBasicMaterial
      return {
        ...base,
        type: 'basic',
        color: this.toColorHex(mat.color),
        wireframe: mat.wireframe,
        opacity: mat.opacity,
        transparent: mat.transparent
      }
    }
    if ((material as THREE.MeshPhongMaterial).isMeshPhongMaterial) {
      const mat = material as THREE.MeshPhongMaterial
      return {
        ...base,
        type: 'phong',
        color: this.toColorHex(mat.color),
        emissive: this.toColorHex(mat.emissive),
        emissiveIntensity: mat.emissiveIntensity,
        opacity: mat.opacity,
        transparent: mat.transparent
      }
    }
    if ((material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
      const mat = material as THREE.MeshPhysicalMaterial
      return {
        ...base,
        type: 'physical',
        color: this.toColorHex(mat.color),
        metalness: mat.metalness,
        roughness: mat.roughness,
        opacity: mat.opacity,
        transparent: mat.transparent,
        maps: this.serializeMaps(mat)
      }
    }
    // default to standard
    const mat = material as THREE.MeshStandardMaterial
    return {
      ...base,
      type: 'standard',
      color: this.toColorHex(mat.color),
      metalness: mat.metalness,
      roughness: mat.roughness,
      opacity: mat.opacity,
      transparent: mat.transparent,
      maps: this.serializeMaps(mat)
    }
  }

  private serializeMaps(material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial): Record<string, TextureSchema> | undefined {
    const entries: Record<string, TextureSchema> = {}
    ;(
      [
        ['map', material.map],
        ['normalMap', material.normalMap],
        ['roughnessMap', material.roughnessMap],
        ['metalnessMap', material.metalnessMap],
        ['envMap', material.envMap],
        ['emissiveMap', material.emissiveMap]
      ] as const
    ).forEach(([key, map]) => {
      const serialized = this.serializeTexture(map as THREE.Texture | undefined)
      if (serialized) entries[key] = serialized
    })
    return Object.keys(entries).length > 0 ? entries : undefined
  }

  private deserializeMaterial(schema: MaterialSchema | MaterialSchema[]): THREE.Material | THREE.Material[] {
    if (Array.isArray(schema)) {
      return schema.map(s => this.deserializeMaterial(s) as THREE.Material)
    }
    switch (schema.type) {
      case 'basic': {
        const mat = new THREE.MeshBasicMaterial()
        if (schema.color) mat.color = new THREE.Color(schema.color)
        mat.opacity = schema.opacity ?? 1
        mat.transparent = schema.transparent ?? false
        mat.wireframe = schema.wireframe ?? false
        mat.name = schema.name ?? ''
        mat.userData = schema.userData ?? {}
        return mat
      }
      case 'phong': {
        const mat = new THREE.MeshPhongMaterial()
        if (schema.color) mat.color = new THREE.Color(schema.color)
        if (schema.emissive) mat.emissive = new THREE.Color(schema.emissive)
        mat.emissiveIntensity = schema.emissiveIntensity ?? 1
        mat.opacity = schema.opacity ?? 1
        mat.transparent = schema.transparent ?? false
        mat.name = schema.name ?? ''
        mat.userData = schema.userData ?? {}
        return mat
      }
      case 'physical': {
        const mat = new THREE.MeshPhysicalMaterial()
        if (schema.color) mat.color = new THREE.Color(schema.color)
        mat.metalness = schema.metalness ?? 0
        mat.roughness = schema.roughness ?? 1
        mat.opacity = schema.opacity ?? 1
        mat.transparent = schema.transparent ?? false
        this.applyMaps(mat, schema.maps)
        mat.name = schema.name ?? ''
        mat.userData = schema.userData ?? {}
        return mat
      }
      default: {
        const mat = new THREE.MeshStandardMaterial()
        if (schema.color) mat.color = new THREE.Color(schema.color)
        mat.metalness = schema.metalness ?? 0
        mat.roughness = schema.roughness ?? 1
        mat.opacity = schema.opacity ?? 1
        mat.transparent = schema.transparent ?? false
        this.applyMaps(mat, schema.maps)
        mat.name = schema.name ?? ''
        mat.userData = schema.userData ?? {}
        return mat
      }
    }
  }

  private applyMaps(material: THREE.MeshStandardMaterial, maps?: Record<string, TextureSchema>): void {
    if (!maps) return
    Object.keys(maps).forEach(key => {
      const schema = maps[key]
      const texture = new THREE.Texture()
      if (schema.url) texture.image = { src: schema.url } as any
      if (schema.repeat) texture.repeat.set(schema.repeat[0], schema.repeat[1])
      if (schema.offset) texture.offset.set(schema.offset[0], schema.offset[1])
      if (schema.rotation !== undefined) texture.rotation = schema.rotation
      texture.wrapS = this.schemaToWrap(schema.wrapS) ?? THREE.ClampToEdgeWrapping
      texture.wrapT = this.schemaToWrap(schema.wrapT) ?? THREE.ClampToEdgeWrapping
      texture.needsUpdate = true
      ;(material as any)[key] = texture
    })
  }

  private serializeEnvironment(scene: THREE.Scene): SceneSchema['environment'] {
    const background = scene.background
    const fog = scene.fog
    const env: SceneSchema['environment'] = {}
    if (background instanceof THREE.Color) {
      env.background = { type: 'color', color: this.toColorHex(background) }
    }
    if (fog) {
      env.fog = {
        enabled: true,
        type: fog instanceof THREE.FogExp2 ? 'exp2' : 'linear',
        color: this.toColorHex(fog.color),
        near: (fog as THREE.Fog).near,
        far: (fog as THREE.Fog).far,
        density: (fog as THREE.FogExp2).density
      }
    }
    return env
  }

  private applyEnvironment(scene: THREE.Scene, env: NonNullable<SceneSchema['environment']>): void {
    if (env.background?.type === 'color' && env.background.color) {
      scene.background = new THREE.Color(env.background.color)
    }
    if (env.fog?.enabled && env.fog.color) {
      if (env.fog.type === 'exp2') {
        scene.fog = new THREE.FogExp2(env.fog.color, env.fog.density ?? 0.001)
      } else {
        scene.fog = new THREE.Fog(env.fog.color, env.fog.near ?? 1, env.fog.far ?? 1000)
      }
    }
  }

  private deserializeLight(schema: LightSchema): THREE.Light {
    switch (schema.type) {
      case 'ambient': {
        const light = new THREE.AmbientLight(schema.color, schema.intensity)
        light.userData = schema.userData ?? {}
        return light
      }
      case 'directional': {
        const light = new THREE.DirectionalLight(schema.color, schema.intensity)
        if (schema.position) light.position.fromArray(schema.position)
        light.castShadow = schema.castShadow ?? false
        light.userData = schema.userData ?? {}
        return light
      }
      case 'point': {
        const light = new THREE.PointLight(schema.color, schema.intensity)
        if (schema.position) light.position.fromArray(schema.position)
        light.userData = schema.userData ?? {}
        return light
      }
      case 'spot': {
        const light = new THREE.SpotLight(schema.color, schema.intensity)
        if (schema.position) light.position.fromArray(schema.position)
        light.castShadow = schema.castShadow ?? false
        light.userData = schema.userData ?? {}
        return light
      }
      default:
        return new THREE.AmbientLight(schema.color, schema.intensity)
    }
  }

  private wrapToSchema(mode: THREE.Wrapping): TextureSchema['wrapS'] {
    switch (mode) {
      case THREE.RepeatWrapping:
        return 'repeat'
      case THREE.MirroredRepeatWrapping:
        return 'mirror'
      default:
        return 'clamp'
    }
  }

  private schemaToWrap(mode?: TextureSchema['wrapS']): THREE.Wrapping | undefined {
    switch (mode) {
      case 'repeat':
        return THREE.RepeatWrapping
      case 'mirror':
        return THREE.MirroredRepeatWrapping
      case 'clamp':
      default:
        return THREE.ClampToEdgeWrapping
    }
  }

  private toColorHex(color: THREE.Color): string {
    return `#${color.getHexString()}`
  }

  private isSerializableObject(object: THREE.Object3D): boolean {
    return EditorObjectPolicy.isSerializable(object)
  }
}
