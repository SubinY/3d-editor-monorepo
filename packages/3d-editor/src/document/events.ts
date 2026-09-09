import type {
  BoundsJSON,
  EditorNodeJSON,
  EnvironmentJSON,
  WallJSON,
  WorkspaceJSON
} from './types'

export interface NodeEventPayload {
  node: EditorNodeJSON
  /** 事件发起方标识（viewport 用于避免自回放） */
  source?: string
}

export interface WallEventPayload {
  wall: WallJSON
}

export interface WorkspaceEventPayload {
  workspace: WorkspaceJSON
}

export interface SelectionEventPayload {
  ids: string[]
}

export type DocumentEventMap = {
  'node:added': NodeEventPayload
  'node:removed': NodeEventPayload
  'node:updated': NodeEventPayload
  'wall:added': WallEventPayload
  'wall:removed': WallEventPayload
  'wall:updated': WallEventPayload
  'workspace:added': WorkspaceEventPayload
  'workspace:removed': WorkspaceEventPayload
  'workspace:updated': WorkspaceEventPayload
  'bounds:updated': { bounds: BoundsJSON }
  'environment:updated': { environment: EnvironmentJSON }
  'selection:changed': SelectionEventPayload
  loaded: void
  change: void
}

type Handler<T> = (payload: T) => void

/** Document 事件总线 */
export class DocumentEmitter {
  private listeners = new Map<string, Set<Handler<unknown>>>()

  on<K extends keyof DocumentEventMap>(event: K, handler: Handler<DocumentEventMap[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler as Handler<unknown>)
    return () => this.off(event, handler)
  }

  off<K extends keyof DocumentEventMap>(event: K, handler: Handler<DocumentEventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>)
  }

  emit<K extends keyof DocumentEventMap>(event: K, payload: DocumentEventMap[K]): void {
    this.listeners.get(event)?.forEach(handler => handler(payload))
  }
}
