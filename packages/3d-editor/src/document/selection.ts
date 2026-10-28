/** 选中以 nodeId / wall id 为准。有序、去重；首项是 primary。 */
export class DocumentSelection {
  private ids: string[] = []

  constructor(private notify: (ids: string[]) => void) {}

  set(idOrIds: string | string[] | null): void {
    const raw = idOrIds == null ? [] : Array.isArray(idOrIds) ? idOrIds : [idOrIds]
    const next = dedupeIds(raw)
    if (next.length === this.ids.length && next.every((id, i) => id === this.ids[i])) return
    this.ids = next
    this.notify(this.get())
  }

  get(): string[] {
    return [...this.ids]
  }

  /** 主选。对齐「参照第一个选中节点」用这一项。 */
  first(): string | undefined {
    return this.ids[0]
  }

  primary(): string | undefined {
    return this.first()
  }

  clear(): void {
    this.set(null)
  }

  isSelected(id: string): boolean {
    return this.ids.includes(id)
  }

  add(id: string): void {
    if (!id || this.isSelected(id)) return
    this.set([...this.ids, id])
  }

  remove(id: string): void {
    if (!this.isSelected(id)) return
    this.set(this.ids.filter(sid => sid !== id))
  }

  /** 未选则追加到末尾（primary 不变）；已选则移除。 */
  toggle(id: string): void {
    if (!id) return
    if (this.isSelected(id)) this.remove(id)
    else this.add(id)
  }
}

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}
