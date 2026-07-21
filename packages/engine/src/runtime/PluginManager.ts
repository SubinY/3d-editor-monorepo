import type * as THREE from 'three'
import type { ControlMode, SceneSchema } from '../types'
import type { CoreContext } from './CoreContext'

export interface TransformEvent {
  object: THREE.Object3D | null
  mode: ControlMode
}

export interface SelectionEvent {
  selection: THREE.Object3D[]
}

export type PluginCleanup = () => void

export interface EnginePlugin {
  name: string
  setup?(ctx: CoreContext): void | PluginCleanup
  onBeforeRender?(ctx: CoreContext, delta: number): void
  onAfterRender?(ctx: CoreContext, delta: number): void
  onSelectionChanged?(ctx: CoreContext, payload: SelectionEvent): void
  onTransform?(ctx: CoreContext, payload: TransformEvent): void
  onSceneSerialized?(schema: SceneSchema): void
  onSceneDeserialized?(schema: SceneSchema): void
  dispose?(): void
}

interface RegisteredPlugin {
  plugin: EnginePlugin
  cleanup?: PluginCleanup
}

export class PluginManager {
  private plugins = new Map<string, RegisteredPlugin>()

  register(plugin: EnginePlugin, ctx: CoreContext): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginManager] Plugin "${plugin.name}" already registered, replacing it.`)
      this.unregister(plugin.name)
    }
    const cleanup = plugin.setup?.(ctx)
    this.plugins.set(plugin.name, { plugin, cleanup: cleanup || undefined })
  }

  registerMany(plugins: EnginePlugin[], ctx: CoreContext): void {
    plugins.forEach(plugin => this.register(plugin, ctx))
  }

  unregister(name: string): void {
    const entry = this.plugins.get(name)
    if (!entry) return
    entry.cleanup?.()
    entry.plugin.dispose?.()
    this.plugins.delete(name)
  }

  emitBeforeRender(ctx: CoreContext, delta: number): void {
    this.plugins.forEach(({ plugin }) => plugin.onBeforeRender?.(ctx, delta))
  }

  emitAfterRender(ctx: CoreContext, delta: number): void {
    this.plugins.forEach(({ plugin }) => plugin.onAfterRender?.(ctx, delta))
  }

  emitSelectionChanged(ctx: CoreContext, payload: SelectionEvent): void {
    this.plugins.forEach(({ plugin }) => plugin.onSelectionChanged?.(ctx, payload))
  }

  emitTransform(ctx: CoreContext, payload: TransformEvent): void {
    this.plugins.forEach(({ plugin }) => plugin.onTransform?.(ctx, payload))
  }

  emitSceneSerialized(schema: SceneSchema): void {
    this.plugins.forEach(({ plugin }) => plugin.onSceneSerialized?.(schema))
  }

  emitSceneDeserialized(schema: SceneSchema): void {
    this.plugins.forEach(({ plugin }) => plugin.onSceneDeserialized?.(schema))
  }

  disposeAll(): void {
    this.plugins.forEach(({ plugin, cleanup }) => {
      cleanup?.()
      plugin.dispose?.()
    })
    this.plugins.clear()
  }
}
