export interface GeoJSONFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: unknown }
  properties?: Record<string, unknown>
}

/**
 * Placeholder 地图层：仅保存 GeoJSON 特征集，渲染由上层实现（挤出、贴图等）。
 */
export class MapLayer {
  constructor(public features: GeoJSONFeature[]) {}
}
