export interface HistoryEntry {
  label: string
  undo(): void
  redo(): void
}

/** Document 唯一 undo/redo 栈 */
export class DocumentHistory {
  private entries: HistoryEntry[] = []
  private cursor = -1
  private limit: number
  private notify?: () => void

  constructor(limit = 100, notify?: () => void) {
    this.limit = limit
    this.notify = notify
  }

  push(entry: HistoryEntry): void {
    this.entries = this.entries.slice(0, this.cursor + 1)
    this.entries.push(entry)
    if (this.entries.length > this.limit) {
      this.entries.shift()
    }
    this.cursor = this.entries.length - 1
    this.notify?.()
  }

  canUndo(): boolean {
    return this.cursor >= 0
  }

  canRedo(): boolean {
    return this.cursor < this.entries.length - 1
  }

  undo(): boolean {
    if (!this.canUndo()) return false
    this.entries[this.cursor].undo()
    this.cursor -= 1
    this.notify?.()
    return true
  }

  redo(): boolean {
    if (!this.canRedo()) return false
    this.cursor += 1
    this.entries[this.cursor].redo()
    this.notify?.()
    return true
  }

  clear(): void {
    this.entries = []
    this.cursor = -1
    this.notify?.()
  }
}
