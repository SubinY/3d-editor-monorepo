import * as THREE from 'three';
import type { SceneSchema } from '../types';
export declare class SceneSerializer {
    serialize(scene: THREE.Scene, camera: THREE.PerspectiveCamera, extras?: Partial<SceneSchema>): SceneSchema;
    deserialize(schema: SceneSchema): {
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
    };
    private serializeObject;
    private deserializeObject;
    private serializeCamera;
    private deserializeCamera;
    private serializeGeometry;
    private deserializeGeometry;
    private serializeTexture;
    private serializeMaterial;
    private serializeMaps;
    private deserializeMaterial;
    private applyMaps;
    private serializeEnvironment;
    private applyEnvironment;
    private deserializeLight;
    private wrapToSchema;
    private schemaToWrap;
    private toColorHex;
    private isSerializableObject;
}
//# sourceMappingURL=SceneSerializer.d.ts.map