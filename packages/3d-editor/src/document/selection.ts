/** 选中以 nodeId / wall id 为准 */
export class DocumentSelection {
  private ids: string[] = []

  constructor(private notify: (ids: string[]) => void) {}

  set(idOrIds: string | string[] | null): void {
    const next = idOrIds == null ? [] : Array.isArray(idOrIds) ? [...idOrIds] : [idOrIds]
    if (next.length === this.ids.length && next.every((id, i) => id === this.ids[i])) return
    this.ids = next
    this.notify(this.get())
  }

  get(): string[] {
    return [...this.ids]
  }

  first(): string | undefined {
    return this.ids[0]
  }

  clear(): void {
    this.set(null)
  }

  isSelected(id: string): boolean {
    return this.ids.includes(id)
  }
}
