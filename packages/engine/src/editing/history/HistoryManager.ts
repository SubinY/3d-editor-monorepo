import type { HistoryOptions, HistorySnapshot } from '../../types'

export interface Command {
  execute(): void
  undo(): void
  redo(): void
  description?: string
}

interface Transaction {
  description: string
  commands: Command[]
}

export class HistoryManager {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private snapshots: HistorySnapshot[] = []
  private options: HistoryOptions
  private currentTransaction: Transaction | null = null

  constructor(options: HistoryOptions = {}) {
    this.options = options
  }

  execute(command: Command): void {
    command.execute()
    if (this.currentTransaction) {
      this.currentTransaction.commands.push(command)
    } else {
      this.undoStack.push(command)
    }
    this.redoStack = []
    this.trim()
  }

  undo(): boolean {
    const cmd = this.undoStack.pop()
    if (!cmd) return false
    cmd.undo()
    this.redoStack.push(cmd)
    return true
  }

  redo(): boolean {
    const cmd = this.redoStack.pop()
    if (!cmd) return false
    cmd.redo()
    this.undoStack.push(cmd)
    return true
  }

  pushSnapshot(snapshot: HistorySnapshot): void {
    this.snapshots.push(snapshot)
    this.trim()
  }

  getState() {
    return { canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 }
  }

  private trim(): void {
    const max = this.options.maxSize
    if (max && this.undoStack.length > max) {
      this.undoStack.shift()
    }
    if (max && this.snapshots.length > max) {
      this.snapshots.shift()
    }
  }

  beginTransaction(description: string): void {
    if (this.currentTransaction) return
    this.currentTransaction = { description, commands: [] }
  }

  endTransaction(): void {
    if (!this.currentTransaction) return
    const commands = this.currentTransaction.commands
    if (commands.length === 0) {
      this.currentTransaction = null
      return
    }
    const batch: Command = {
      description: this.currentTransaction.description,
      execute: () => commands.forEach(cmd => cmd.execute()),
      undo: () => [...commands].reverse().forEach(cmd => cmd.undo()),
      redo: () => commands.forEach(cmd => cmd.redo())
    }
    this.undoStack.push(batch)
    this.currentTransaction = null
  }

  cancelTransaction(): void {
    if (!this.currentTransaction) return
    [...this.currentTransaction.commands].reverse().forEach(cmd => cmd.undo())
    this.currentTransaction = null
  }

  recordTransform(_objectId: string, before: unknown, after: unknown): void {
    const command: Command = {
      description: 'transform',
      execute: () => {},
      undo: () => {},
      redo: () => {}
    }
    this.execute(command)
    this.pushSnapshot({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'object',
      action: 'modify',
      description: 'transform',
      before,
      after
    })
  }
}
