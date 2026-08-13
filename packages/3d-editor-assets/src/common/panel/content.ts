import { deepClone } from '../../utils/deep-clone'
import { nextId } from '../../utils/next-id'
import type { PanelContentJSON } from './types'

export function nextElementId(prefix = 'el'): string {
  return nextId(prefix)
}

export function createDefaultContent(overrides?: Partial<PanelContentJSON>): PanelContentJSON {
  return {
    width: 1024,
    height: 512,
    background: 'transparent',
    worldWidth: 1.6,
    billboard: 'yaw',
    elements: [
      {
        id: 'value',
        type: 'text',
        name: '数值',
        left: 40,
        top: 80,
        width: 700,
        height: 200,
        text: '7618',
        color: '#ffffff',
        fontSize: 168,
        fontWeight: 800,
        fontFamily: 'Arial Black, Arial, sans-serif',
        align: 'left',
        baseline: 'middle'
      },
      {
        id: 'unit',
        type: 'text',
        name: '单位',
        left: 620,
        top: 140,
        width: 200,
        height: 80,
        text: 'KW',
        color: 'rgba(255,255,255,0.55)',
        fontSize: 56,
        fontWeight: 600,
        align: 'left',
        baseline: 'middle'
      },
      {
        id: 'title',
        type: 'text',
        name: '标题',
        left: 40,
        top: 320,
        width: 900,
        height: 64,
        text: '降压变电站1#设备变压设备',
        color: '#ffffff',
        fontSize: 28,
        fontWeight: 500,
        background: 'rgba(0,0,0,0.72)',
        align: 'left',
        baseline: 'middle'
      }
    ],
    ...overrides
  }
}

export function cloneContent(content: PanelContentJSON): PanelContentJSON {
  return deepClone(content)
}

export function isContent(value: unknown): value is PanelContentJSON {
  if (!value || typeof value !== 'object') return false
  const v = value as PanelContentJSON
  return typeof v.width === 'number' && typeof v.height === 'number' && Array.isArray(v.elements)
}
