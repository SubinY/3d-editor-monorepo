import * as THREE from 'three'
import { Renderer, RendererOptions } from './Renderer'
import { RenderLoop } from './RenderLoop'
import { CameraManager } from './CameraManager'
import { EventBus, EditorEvents } from './EventBus'
import { OrbitController } from '../editing/controls/OrbitController'
import { TransformController } from '../editing/controls/TransformController'
import { SelectionManager } from '../editing/interaction/SelectionManager'
import { HistoryManager } from '../editing/history/HistoryManager'
import { AnimationSystem } from '../animation/AnimationSystem'
import { SceneSerializer } from '../io/SceneSerializer'
import { AxisHelper } from '../editing/helpers/AxisHelper'
import { SceneGraphManager } from '../editing/scene/SceneGraphManager'
import { AlignmentTool } from '../editing/tools/AlignmentTool'
import { SelectionHighlight } from '../editing/effects/SelectionHighlight'
import { PluginManager, type EnginePlugin } from './PluginManager'
import { PresetManager, type ScenePreset, type AppliedPreset } from './PresetManager'
import { EditorActions } from './EditorActions'
import type { ControlAdapter } from '../editing/controls/ControlAdapter'
import type { RendererOptionsSchema, SceneSchema, TransformSchema } from '../types'

export interface CoreContextOptions {
  container: HTMLElement
  rendererOptions?: RendererOptions | RendererOptionsSchema
  controls?: {
    factory?: (camera: THREE.Camera, dom: HTMLElement) => ControlAdapter
  }
  plugins?: EnginePlugin[]
  presets?: ScenePreset[]
  history?: {
    /**
     * 拖拽结束后是否自动写入 engine 自身的 HistoryManager。
     * 上层若以外部 Document 命令栈为唯一历史（如 @3d-editor/editor），应设为 false，
     * engine 侧降级为执行器，仅继续派发 OBJECT_TRANSFORMED 事件。
     */
    autoRecordTransform?: boolean
  }
}

export class CoreContext {
  public scene: THREE.Scene
  public renderer: Renderer
  public renderLoop: RenderLoop
  public cameraManager: CameraManager
  public controls: ControlAdapter
  public orbit?: OrbitController
  public transform: TransformController
  public selection: SelectionManager
  public history: HistoryManager
  public animation: AnimationSystem
  public serializer: SceneSerializer
  public eventBus: EventBus
  public pluginManager: PluginManager
  public axisHelper: AxisHelper
  public sceneGraph: SceneGraphManager
  public alignment: AlignmentTool
  public highlight: SelectionHighlight
  public actions: EditorActions
  public presetManager: PresetManager

  private transformBefore?: TransformSchema
  private autoRecordTransform: boolean

  constructor(options: CoreContextOptions) {
    this.autoRecordTransform = options.history?.autoRecordTransform ?? true
    this.scene = new THREE.Scene()
    this.eventBus = new EventBus()
    this.pluginManager = new PluginManager()
    this.presetManager = new PresetManager()
    this.renderer = new Renderer(options.container, options.rendererOptions)
    this.renderLoop = new RenderLoop()
    this.cameraManager = new CameraManager(options.container)

    const controlFactory = options.controls?.factory ?? ((camera: THREE.Camera, dom: HTMLElement) => new OrbitController(camera, dom))
    this.controls = controlFactory(this.cameraManager.camera, this.renderer.domElement)
    if (this.controls instanceof OrbitController) {
      this.orbit = this.controls
    }

    this.transform = new TransformController(this.cameraManager.camera, this.renderer.domElement)
    this.selection = new SelectionManager(this.cameraManager.camera, this.eventBus)
    this.history = new HistoryManager()
    this.animation = new AnimationSystem()
    this.serializer = new SceneSerializer()
    this.axisHelper = new AxisHelper(this.renderer.renderer)
    this.sceneGraph = new SceneGraphManager(this.scene)
    this.alignment = new AlignmentTool()
    this.highlight = new SelectionHighlight(this.scene, this.cameraManager.camera, this.renderer.renderer, {
      color: 0x87cefa,
      thickness: 3,
      pulsate: true
    })
    this.actions = new EditorActions(
      this.scene,
      this.history,
      this.sceneGraph,
      this.alignment,
      this.selection,
      this.eventBus
    )

    this.selection.setSceneGraphManager(this.sceneGraph)
    this.selection.onSelectionChanged = selection => {
      this.pluginManager.emitSelectionChanged(this, { selection })
    }

    this.axisHelper.worldAxis.userData.nonSelectable = true
    this.axisHelper.worldAxis.traverse(child => {
      child.userData.nonSelectable = true
      child.raycast = () => {}
    })
    this.scene.add(this.axisHelper.worldAxis)

    this.renderLoop.start(delta => {
      this.pluginManager.emitBeforeRender(this, delta)
      this.controls.update(delta)
      this.animation.update(delta)
      this.highlight.update(delta)
      this.renderer.render(this.scene, this.cameraManager.camera)
      this.axisHelper.update(this.cameraManager.camera)
      this.pluginManager.emitAfterRender(this, delta)
    })

    this.transform.controls.addEventListener('objectChange', this.handleTransformChange)
    this.transform.controls.addEventListener('dragging-changed', this.handleDraggingChanged)

    window.addEventListener('resize', this.handleResize)
    this.handleResize()

    if (options.presets?.length) {
      this.presetManager.registerMany(options.presets)
    }
    if (options.plugins?.length) {
      this.pluginManager.registerMany(options.plugins, this)
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    this.transform.controls.removeEventListener('objectChange', this.handleTransformChange)
    this.transform.controls.removeEventListener('dragging-changed', this.handleDraggingChanged)
    this.renderLoop.stop()
    this.controls.dispose()
    this.transform.dispose()
    this.highlight.dispose()
    this.renderer.dispose()
    this.presetManager.disposeActive(this)
    this.pluginManager.disposeAll()
  }

  public loadScene(schema: SceneSchema): void {
    const loaded = this.serializer.deserialize(schema)
    this.scene = loaded.scene
    this.cameraManager.setCamera(loaded.camera)
    this.sceneGraph.setScene(loaded.scene)
    this.actions.setScene(this.scene)
    this.selection.setSceneGraphManager(this.sceneGraph)
    this.scene.add(this.axisHelper.worldAxis)
    this.scene.add(this.transform.controls)
    this.highlight.setScene(loaded.scene)
    this.highlight.setCamera(loaded.camera)
    this.pluginManager.emitSceneDeserialized(schema)
  }

  public serializeScene(extras?: Partial<SceneSchema>): SceneSchema {
    const schema = this.serializer.serialize(this.scene, this.cameraManager.camera, extras)
    this.pluginManager.emitSceneSerialized(schema)
    return schema
  }

  public applyPreset<TOptions = unknown, TState = unknown>(
    presetOrId: ScenePreset<TOptions, TState> | string,
    options?: TOptions
  ): Promise<AppliedPreset<TState>> {
    return this.presetManager.apply(this, presetOrId, options)
  }

  private handleResize = (): void => {
    const { clientWidth, clientHeight } = this.renderer.domElement.parentElement || document.body
    this.cameraManager.updateAspect(clientWidth, clientHeight)
    this.renderer.setSize(clientWidth, clientHeight)
    this.highlight.setSize(clientWidth, clientHeight)
  }

  private handleTransformChange = (): void => {
    const object = this.transform.controls.object as THREE.Object3D | null
    if (!object) return
    this.pluginManager.emitTransform(this, { object, mode: this.transform.getMode() })
    this.eventBus.emit(EditorEvents.OBJECT_TRANSFORMED, { id: object.uuid, mode: this.transform.getMode() })
  }

  private handleDraggingChanged = (event: { value?: unknown }): void => {
    const isDragging = event?.value === true
    this.controls.setEnabled?.(!isDragging)
    if (isDragging) {
      const object = this.transform.controls.object as THREE.Object3D | null
      if (object) {
        this.transformBefore = this.captureTransform(object)
      }
      return
    }

    const object = this.transform.controls.object as THREE.Object3D | null
    if (object && this.transformBefore) {
      const after = this.captureTransform(object)
      if (this.autoRecordTransform) {
        this.history.recordTransform(object.uuid, this.transformBefore, after)
      }
      this.eventBus.emit(EditorEvents.OBJECT_TRANSFORMED, {
        id: object.uuid,
        before: this.transformBefore,
        after,
        mode: this.transform.getMode()
      })
      this.pluginManager.emitTransform(this, { object, mode: this.transform.getMode() })
    }
    this.transformBefore = undefined
  }

  private captureTransform(object: THREE.Object3D): TransformSchema {
    return {
      position: object.position.toArray() as [number, number, number],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: object.scale.toArray() as [number, number, number],
      quaternion: object.quaternion.toArray() as [number, number, number, number]
    }
  }
}
