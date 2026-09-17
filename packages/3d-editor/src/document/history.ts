export interface HistoryEntry {
  label: string
  undo(): void
  redo(): void
}

/** Document 唯一 undo/redo 栈 */
export class DocumentHistory {
  private entries: HistoryEntry[] = []
  private cursor = -1
  /** 与 cursor 对齐表示干净；cleanValid=false 表示干净点已失效（恒 dirty） */
  private cleanCursor = -1
  private cleanValid = true
  private limit: number
  private notify?: () => void
  /** >0 时 push 进入 batch，由 transaction 合并为一条 */
  private batchDepth = 0
  private batch: HistoryEntry[] | null = null

  constructor(limit = 100, notify?: () => void) {
    this.limit = limit
    this.notify = notify
  }

  push(entry: HistoryEntry): void {
    if (this.batchDepth > 0 && this.batch) {
      this.batch.push(entry)
      return
    }
    this.entries = this.entries.slice(0, this.cursor + 1)
    if (this.cleanValid && this.cleanCursor > this.cursor) {
      this.cleanValid = false
    }
    this.entries.push(entry)
    if (this.entries.length > this.limit) {
      this.entries.shift()
      if (this.cleanValid) {
        this.cleanCursor -= 1
        if (this.cleanCursor < -1) this.cleanValid = false
      }
    }
    this.cursor = this.entries.length - 1
    this.notify?.()
  }

  /**
   * 将 fn 内产生的多条历史合并为一条。
   * 嵌套 transaction 会并入外层 batch。
   */
  transaction(label: string, fn: () => void): void {
    if (this.batchDepth === 0) this.batch = []
    this.batchDepth += 1
    try {
      fn()
    } finally {
      this.batchDepth -= 1
      if (this.batchDepth === 0) {
        const parts = this.batch ?? []
        this.batch = null
        if (parts.length === 0) return
        if (parts.length === 1) {
          this.push(parts[0])
          return
        }
        this.push({
          label,
          undo: () => {
            for (let i = parts.length - 1; i >= 0; i -= 1) parts[i].undo()
          },
          redo: () => {
            for (const part of parts) part.redo()
          }
        })
      }
    }
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

  /** 将当前 cursor 标为已保存干净点 */
  markClean(): void {
    this.cleanCursor = this.cursor
    this.cleanValid = true
  }

  /** 强制标脏（如恢复会话时内容相对服务端仍有未保存改动） */
  markDirty(): void {
    this.cleanValid = false
  }

  isDirty(): boolean {
    console.log('isDirty', this.cleanValid, this.cursor, this.cleanCursor)
    if (!this.cleanValid) return true
    return this.cursor !== this.cleanCursor
  }

  clear(): void {
    this.entries = []
    this.cursor = -1
    this.cleanCursor = -1
    this.cleanValid = true
    this.batchDepth = 0
    this.batch = null
    this.notify?.()
  }
}
