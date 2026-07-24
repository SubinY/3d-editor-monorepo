export interface AssetMeta {
    id: string;
    name: string;
    tags?: string[];
    url: string;
    size?: number;
}
export declare class AssetRegistry {
    private assets;
    register(meta: AssetMeta): void;
    get(id: string): AssetMeta | undefined;
    list(): AssetMeta[];
}
//# sourceMappingURL=AssetRegistry.d.ts.map