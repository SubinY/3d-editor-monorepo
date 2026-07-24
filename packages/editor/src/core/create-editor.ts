import type { CatalogProvider } from '../catalog/types'
import type { CreateDocumentOptions, EditorDocument } from '../document/EditorDocument'
import { createDocument, loadDocument } from '../document/serialize'
import type { EditorDocumentJSON } from '../document/types'
import { Viewport2D } from '../viewport/canvas2d/Viewport2D'
import type { Viewport2DOptions } from '../viewport/canvas2d/types'
import { Viewport3D } from '../viewport/three/Viewport3D'
import type { Viewport3DOptions } from '../viewport/three/Viewport3D'
import type { CreateEditorOptions, EditorSession } from './types'

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
  private disposed = false

  constructor(document: EditorDocument, options: CreateEditorOptions) {
    this.document = document
    this.catalog = options.catalog
    this.onDenied = options.onDenied
    this.viewport3dOptions = options.viewport3d

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
      onDenied: this.onDenied
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
      onNodeClick: this.viewport3dOptions?.onNodeClick
    }
    this.viewport3d = new Viewport3D(el, options)
    return this.viewport3d
  }

  unmountCanvas3d(): void {
    this.viewport3d?.dispose()
    this.viewport3d = undefined
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
