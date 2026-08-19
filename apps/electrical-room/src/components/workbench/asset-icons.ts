import type { CatalogItem } from '@mh/3d-editor'

/** 静态内联 SVG（stroke 图标，适配深色资源盘） */
const SVG = {
  door: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15" cy="12" r="1"/><path d="M5 21h14"/></svg>`,
  window: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M12 5v14M4 12h16"/></svg>`,
  column: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12M7 4v3h10V4M8 7v10h8V7M6 20h12M7 17h10"/></svg>`,
  panel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M7 9h10M7 12h7M7 15h5"/></svg>`,
  breaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 7h6M9 10h6"/><circle cx="12" cy="15" r="2"/><path d="M12 17v2"/></svg>`,
  contactor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/><circle cx="16" cy="16" r="1.2"/></svg>`,
  terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="1"/><path d="M6 9V7M10 9V7M14 9V7M18 9V7M6 15v2M10 15v2M14 15v2M18 15v2"/></svg>`,
  cabinet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="1.5"/><path d="M5 6h14M5 18h14"/><circle cx="15" cy="12" r="1"/><path d="M8 9h4M8 12h4M8 15h3"/></svg>`,
  effect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>`
} as const

export type AssetIconKey = keyof typeof SVG

export function isImageThumb(thumb?: string): boolean {
  if (!thumb) return false
  return (
    thumb.startsWith('http') ||
    thumb.startsWith('/') ||
    thumb.startsWith('data:image') ||
    thumb.startsWith('blob:')
  )
}

export function resolveAssetIconKey(item: CatalogItem): AssetIconKey {
  if (item.id === 'fix-door' || item.kind === 'door') return 'door'
  if (item.id === 'fix-window' || item.kind === 'window') return 'window'
  if (item.id === 'fix-column' || item.kind === 'column') return 'column'
  if (item.id === 'ui-info-panel' || item.kind === 'panel') return 'panel'
  if (item.id === 'comp-breaker') return 'breaker'
  if (item.id === 'comp-contactor') return 'contactor'
  if (item.id === 'comp-terminal') return 'terminal'
  if (item.kind === 'cabinet' || item.id.startsWith('cabinet-')) return 'cabinet'
  if (item.category === 'effect') return 'effect'
  if (item.category === 'equipment') return 'cabinet'
  if (item.category === 'component') return 'breaker'
  return 'box'
}

export function resolveAssetIconSvg(item: CatalogItem): string {
  return SVG[resolveAssetIconKey(item)]
}
