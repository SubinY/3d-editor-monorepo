import type { CatalogProvider, ProceduralModelResolver } from '../catalog/types'
import type { CreateDocumentOptions, EditorDocument } from '../document/EditorDocument'
import { createDocument, loadDocument } from '../document/serialize'
import type { EditorDocumentJSON } from '../document/types'
import { Viewport2D } from '../viewport/canvas2d/Viewport2D'
import type { Viewport2DOptions } from '../viewport/canvas2d/types'
import { Viewport3D } from '../viewport/three/Viewport3D'
import type { Viewport3DOptions } from '../viewport/three/Viewport3D'
import {
  modesIncludeScale,
  normalizeTransformModes,
  pickTransformMode
} from './interaction'
import type {
  CreateEditorOptions,
  EditorInteractionState,
  EditorSession,
  TransformMode
} from './types'

function isDocumentJSON(value: EditorDocumentJSON | CreateDocumentOptions): value is EditorDocumentJSON {
  return (
    typeof (value as EditorDocumentJSON).schemaVersion === 'string' &&
    Array.isArray((value as EditorDocumentJSON).nodes)
  )
}

export class EditorSessionImpl implements EditorSession {
  public readonly document: EditorDocument
  public viewport2d?: Viewport2D
  public viewport3d?: Viewport3D

  private catalog?: CatalogProvider
  private onDenied?: (reason: string) => void
  private viewport3dOptions?: CreateEditorOptions['viewport3d']
  private viewport2dOptions?: CreateEditorOptions['viewport2d']
  private proceduralResolvers?: ProceduralModelResolver[]
  private disposed = false

  private snapEnabled: boolean
  private collisionPreference: boolean
  private transformModes: TransformMode[]
  private transformMode: TransformMode

  constructor(document: EditorDocument, options: CreateEditorOptions) {
    this.document = document
    this.catalog = options.catalog
    this.onDenied = options.onDenied
    this.viewport3dOptions = options.viewport3d
    this.viewport2dOptions = options.viewport2d
    this.proceduralResolvers = options.procedural?.resolvers

    const interaction = options.interaction
    this.snapEnabled = interaction?.snapEnabled ?? true
    this.collisionPreference = interaction?.collisionEnabled ?? true
    this.transformModes = normalizeTransformModes(interaction?.transformModes)
    this.transformMode = pickTransformMode(this.transformModes, 'translate')

    if (
      modesIncludeScale(this.transformModes) &&
      (interaction?.collisionEnabled ?? true) === true
    ) {
      console.warn(
        '[createEditor] transformModes includes "scale"; collisionEnabled forced to false (scale ↔ collision mutex)'
      )
    }

    this.applyInteraction()

    if (options.mount?.canvas2d) {
      this.mountCanvas2d(options.mount.canvas2d)
    }
    if (options.mount?.canvas3d) {
      this.mountCanvas3d(options.mount.canvas3d)
    }
  }

  mountCanvas2d(el: HTMLElement): Viewport2D {
    this.ensureAlive()
    this.unmountCanvas2d()
    const options: Viewport2DOptions = {
      document: this.document,
      catalog: this.catalog,
      onDenied: this.onDenied,
      snapEnabled: this.snapEnabled,
      showNodeNames: this.viewport2dOptions?.showNodeNames,
      onPickCandidates: this.viewport2dOptions?.onPickCandidates
    }
    this.viewport2d = new Viewport2D(el, options)
    return this.viewport2d
  }

  unmountCanvas2d(): void {
    this.viewport2d?.dispose()
    this.viewport2d = undefined
  }

  mountCanvas3d(el: HTMLElement): Viewport3D {
    this.ensureAlive()
    this.unmountCanvas3d()
    const options: Viewport3DOptions = {
      document: this.document,
      catalog: this.catalog,
      readonly: this.viewport3dOptions?.readonly,
      onInteraction: this.viewport3dOptions?.onInteraction,
      transformModes: this.transformModes,
      transformMode: this.transformMode,
      snapEnabled: this.snapEnabled,
      perfStats: this.viewport3dOptions?.perfStats,
      hoverOutline: this.viewport3dOptions?.hoverOutline,
      proceduralResolvers: this.proceduralResolvers
    }
    this.viewport3d = new Viewport3D(el, options)
    return this.viewport3d
  }

  unmountCanvas3d(): void {
    this.viewport3d?.dispose()
    this.viewport3d = undefined
  }

  getInteraction(): EditorInteractionState {
    return {
      snapEnabled: this.snapEnabled,
      collisionEnabled: this.document.collisionEnabled,
      collisionPreference: this.collisionPreference,
      transformModes: [...this.transformModes],
      transformMode: this.transformMode
    }
  }

  setSnapEnabled(enabled: boolean): void {
    this.ensureAlive()
    this.snapEnabled = enabled
    this.viewport2d?.setSnapEnabled(enabled)
    this.viewport3d?.setSnapEnabled(enabled)
  }

  setCollisionEnabled(enabled: boolean): void {
    this.ensureAlive()
    this.collisionPreference = enabled
    if (enabled && modesIncludeScale(this.transformModes)) {
      this.transformModes = this.transformModes.filter(mode => mode !== 'scale')
      if (this.transformModes.length === 0) this.transformModes = ['translate']
      this.transformMode = pickTransformMode(this.transformModes, this.transformMode)
    }
    this.applyInteraction()
  }

  setTransformModes(modes: TransformMode[]): void {
    this.ensureAlive()
    this.transformModes = normalizeTransformModes(modes)
    this.transformMode = pickTransformMode(this.transformModes, this.transformMode)
    this.applyInteraction()
  }

  setTransformMode(mode: TransformMode): void {
    this.ensureAlive()
    if (!this.transformModes.includes(mode)) return
    this.transformMode = mode
    this.viewport3d?.setTransformMode(mode)
  }

  toJSON(): EditorDocumentJSON {
    return this.document.toJSON()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unmountCanvas2d()
    this.unmountCanvas3d()
  }

  private applyInteraction(): void {
    const hasScale = modesIncludeScale(this.transformModes)
    this.document.collisionEnabled = hasScale ? false : this.collisionPreference
    this.viewport2d?.setSnapEnabled(this.snapEnabled)
    this.viewport3d?.setTransformModes(this.transformModes)
    this.viewport3d?.setTransformMode(this.transformMode)
    this.viewport3d?.setSnapEnabled(this.snapEnabled)
  }

  private ensureAlive(): void {
    if (this.disposed) throw new Error('EditorSession is disposed')
  }
}

export async function createEditor(options: CreateEditorOptions): Promise<EditorSession> {
  let document: EditorDocument
  if (isDocumentJSON(options.document)) {
    const loaded = await loadDocument(options.document, { catalog: options.catalog })
    document = loaded.document
  } else {
    document = createDocument(options.document)
    if (options.catalog) {
      document.attachCatalog(options.catalog)
      await document.resolveItems()
    }
  }

  return new EditorSessionImpl(document, options)
}
