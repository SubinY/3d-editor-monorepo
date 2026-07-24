export interface GeoJSONFeature {
    type: 'Feature';
    geometry: {
        type: string;
        coordinates: unknown;
    };
    properties?: Record<string, unknown>;
}
/**
 * Placeholder 地图层：仅保存 GeoJSON 特征集，渲染由上层实现（挤出、贴图等）。
 */
export declare class MapLayer {
    features: GeoJSONFeature[];
    constructor(features: GeoJSONFeature[]);
}
//# sourceMappingURL=index.d.ts.map