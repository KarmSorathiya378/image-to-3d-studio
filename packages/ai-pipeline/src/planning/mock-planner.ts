import type { SceneSpec } from './types.ts';
import type { ObjectCategory } from '../vision/types.ts';

/**
 * Deterministic mock planner for unit tests, offline acceptance tests, and golden comparisons.
 */
export function getMockSceneSpec(category: ObjectCategory = 'stool'): SceneSpec {
  switch (category) {
    case 'stool':
      return {
        schemaVersion: '1.0',
        objectName: 'procedural_stool',
        coordinateSystem: 'Z_UP',
        units: 'relative',
        referenceView: { azimuthDeg: 35.0, elevationDeg: 18.0 },
        parts: [
          {
            id: 'seat',
            type: 'cylinder',
            size: [1.4, 1.4, 0.16],
            position: [0.0, 0.0, 1.18],
            rotationDeg: [0.0, 0.0, 0.0],
            materialId: 'wood_oak',
          },
          {
            id: 'leg_front_left',
            type: 'cylinder',
            size: [0.12, 0.12, 1.1],
            position: [-0.45, -0.45, 0.55],
            rotationDeg: [4.0, 4.0, 0.0],
            materialId: 'wood_oak',
          },
          {
            id: 'leg_front_right',
            type: 'cylinder',
            size: [0.12, 0.12, 1.1],
            position: [0.45, -0.45, 0.55],
            rotationDeg: [4.0, -4.0, 0.0],
            materialId: 'wood_oak',
          },
          {
            id: 'leg_rear',
            type: 'cylinder',
            size: [0.12, 0.12, 1.1],
            position: [0.0, 0.5, 0.55],
            rotationDeg: [-5.0, 0.0, 0.0],
            materialId: 'wood_oak',
          },
        ],
        materials: [
          {
            id: 'wood_oak',
            baseColor: '#8F684A',
            roughness: 0.72,
            metallic: 0.0,
          },
        ],
        uncertaintyNotes: [
          'Rear leg position and underside joinery inferred from single perspective view.',
        ],
      };

    case 'desk_lamp':
      return {
        schemaVersion: '1.0',
        objectName: 'procedural_desk_lamp',
        coordinateSystem: 'Z_UP',
        units: 'relative',
        referenceView: { azimuthDeg: 40.0, elevationDeg: 12.0 },
        parts: [
          {
            id: 'base_plate',
            type: 'cylinder',
            size: [0.9, 0.9, 0.08],
            position: [0.0, 0.0, 0.04],
            rotationDeg: [0.0, 0.0, 0.0],
            materialId: 'metal_matte_black',
          },
          {
            id: 'stem',
            type: 'cylinder',
            size: [0.06, 0.06, 1.35],
            position: [0.0, 0.0, 0.75],
            rotationDeg: [0.0, 0.0, 0.0],
            materialId: 'metal_matte_black',
          },
          {
            id: 'shade',
            type: 'cone',
            size: [0.6, 0.6, 0.45],
            position: [0.25, 0.0, 1.45],
            rotationDeg: [0.0, 45.0, 0.0],
            materialId: 'metal_cream',
          },
        ],
        materials: [
          {
            id: 'metal_matte_black',
            baseColor: '#222222',
            roughness: 0.4,
            metallic: 0.8,
          },
          {
            id: 'metal_cream',
            baseColor: '#F0E6D2',
            roughness: 0.3,
            metallic: 0.2,
          },
        ],
        uncertaintyNotes: ['Internal socket wiring and rear surface not visible.'],
      };

    case 'box':
    default:
      return {
        schemaVersion: '1.0',
        objectName: 'procedural_storage_box',
        coordinateSystem: 'Z_UP',
        units: 'relative',
        referenceView: { azimuthDeg: 45.0, elevationDeg: 25.0 },
        parts: [
          {
            id: 'box_body',
            type: 'box',
            size: [1.4, 1.0, 0.7],
            position: [0.0, 0.0, 0.35],
            rotationDeg: [0.0, 0.0, 0.0],
            materialId: 'cardboard_brown',
          },
          {
            id: 'box_lid',
            type: 'box',
            size: [1.44, 1.04, 0.06],
            position: [0.0, 0.0, 0.73],
            rotationDeg: [0.0, 0.0, 0.0],
            materialId: 'cardboard_brown',
          },
        ],
        materials: [
          {
            id: 'cardboard_brown',
            baseColor: '#B28247',
            roughness: 0.85,
            metallic: 0.0,
          },
        ],
        uncertaintyNotes: ['Interior compartment layout is inferred.'],
      };
  }
}
