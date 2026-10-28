/** 多选描边：每个选中根一套 HoverHighlight，primary 用单独颜色。 */
import type * as THREE from 'three'
import { HoverHighlight } from './hover-highlight'

const PRIMARY = '#f5a623'
const MEMBER = '#4c8dff'

export class SelectionOutlines {
  private highlights = new Map<string, HoverHighlight>()

  constructor(private renderer: THREE.WebGLRenderer) {}

  sync(
    entries: Array<{ id: string; root: THREE.Object3D; nested: THREE.Object3D[]; primary: boolean }>
  ): void {
    const next = new Set(entries.map(entry => this.key(entry.id, entry.primary)))
    for (const [key, highlight] of this.highlights) {
      if (!next.has(key)) {
        highlight.dispose()
        this.highlights.delete(key)
      }
    }
    for (const entry of entries) {
      const key = this.key(entry.id, entry.primary)
      let highlight = this.highlights.get(key)
      if (!highlight) {
        highlight = new HoverHighlight(this.renderer, {
          color: entry.primary ? PRIMARY : MEMBER,
          thickness: entry.primary ? 3 : 2
        })
        this.highlights.set(key, highlight)
      }
      highlight.setTarget(null)
      highlight.setTarget(entry.root, entry.nested)
    }
  }

  private key(id: string, primary: boolean): string {
    return `${id}:${primary ? 'p' : 'm'}`
  }

  setSize(width: number, height: number): void {
    this.highlights.forEach(highlight => highlight.setSize(width, height))
  }

  dispose(): void {
    this.highlights.forEach(highlight => highlight.dispose())
    this.highlights.clear()
  }
}
