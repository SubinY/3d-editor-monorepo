# Scene Schema Overview

Core protocol lives in `packages/engine/src/types.ts` and is read/written by `SceneSerializer`.

## Covered today (read/write)
- `objects`: Mesh/Group nodes (transform, geometry, material, shadow flags, layer, userData, children).
- `lights`: Ambient/Directional/Point/Spot (color, intensity, position, shadow, userData).
- `camera`: Perspective (fov/aspect/near/far/position/target).
- `environment`: Background color and fog (linear/exp2).
- `customData` / `metadata`: Stored on `scene.userData` and round-tripped.

## Optional fields (attach via `serializeScene(extras)` or plugin hooks)
- `controls` (controller params), `renderer` (renderer params), `postProcessing` (post FX settings).
- `animations` / `TimelineSchema`: Timeline/animation data (not auto-applied yet; use business logic or extensions to drive objects).
- `physics`: Physics body descriptors (no solver integration yet).

## Filtering rules
- Selection and serialization share `EditorObjectPolicy`:
  - Skip Axis/Grid/TransformControls, highlight helpers, `userData.nonSelectable`.
  - Lights are serialized separately, not in `objects`.

## Versioning & extension
- `SceneSerializer` default `version = "1.0.0"`.
- `dsl/ExtendedSceneSchema` can host custom fields; fill them via plugin hooks like `onSceneSerialized`.
