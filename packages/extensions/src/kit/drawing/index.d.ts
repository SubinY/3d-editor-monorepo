export type DrawShape = 'polyline' | 'polygon' | 'spline';
export interface DrawPoint {
    x: number;
    y: number;
    z: number;
}
export interface DrawPath {
    id: string;
    shape: DrawShape;
    points: DrawPoint[];
}
export declare class DrawingManager {
    private paths;
    createPath(shape: DrawShape, points: DrawPoint[]): DrawPath;
    removePath(id: string): void;
    list(): DrawPath[];
}
//# sourceMappingURL=index.d.ts.map