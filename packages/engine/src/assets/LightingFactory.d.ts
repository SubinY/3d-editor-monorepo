import * as THREE from 'three';
import type { LightSchema } from '../types';
export declare const createAmbientLight: (color?: number | string, intensity?: number) => THREE.AmbientLight;
export declare const createDirectionalLight: (color?: number | string, intensity?: number, position?: [number, number, number]) => THREE.DirectionalLight;
export declare const serializeLight: (light: THREE.Light) => LightSchema;
//# sourceMappingURL=LightingFactory.d.ts.map