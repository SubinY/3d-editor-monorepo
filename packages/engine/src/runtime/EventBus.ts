export type EventHandler<T = unknown> = (payload?: T) => void

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>()

  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(handler as EventHandler)
  }

  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as EventHandler)
  }

  emit<T = unknown>(event: string, payload?: T): void {
    this.listeners.get(event)?.forEach(handler => handler(payload))
  }

  once<T = unknown>(event: string, handler: EventHandler<T>): void {
    const wrapper: EventHandler<T> = payload => {
      handler(payload)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }
}

export const EditorEvents = {
  OBJECT_SELECTED: 'object:selected',
  OBJECT_TRANSFORMED: 'object:transformed',
  OBJECT_ADDED: 'object:added',
  OBJECT_REMOVED: 'object:removed',
  SCENE_UPDATED: 'scene:updated',
  TOOL_CHANGED: 'tool:changed'
} as const

export type EditorEventName = (typeof EditorEvents)[keyof typeof EditorEvents]

