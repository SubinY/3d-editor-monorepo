export interface TextOptions {
    text: string;
    size?: number;
    height?: number;
    bevelEnabled?: boolean;
}
/**
 * Placeholder 文本工厂：返回配置对象，需结合 Three.js TextGeometry 或 troika-3d-text 渲染。
 */
export declare class TextFactory {
    create(options: TextOptions): TextOptions;
}
//# sourceMappingURL=index.d.ts.map