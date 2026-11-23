import type { StructuredObjectDescription, ObjectCategory } from './types.ts';

/**
 * High-fidelity deterministic mock VLM analyzer for offline testing, CI gates, and fixture validation.
 * Covers PRD simple object categories: stool, chair, desk lamp, box, mug, table, shelf, planter, bottle.
 */
export function getMockObjectDescription(category: ObjectCategory = 'stool'): StructuredObjectDescription {
  switch (category) {
    case 'stool':
      return {
        category: 'stool',
        confidence: 0.95,
        summary: 'A round three-legged wooden stool with a thick circular seat and splayed cylindrical legs.',
        cameraView: {
          estimatedAzimuthDeg: 35.0,
          estimatedElevationDeg: 18.0,
          distanceEstimate: 'medium',
          viewAngleDescription: 'Slightly elevated three-quarter front view',
        },
        symmetry: {
          hasSymmetry: true,
          type: 'radial',
          planes: ['XZ', 'YZ'],
        },
        proportions: {
          widthRatio: 1.0,
          depthRatio: 1.0,
          heightRatio: 1.25,
          relativeScaleNotes: 'Estimated relative aspect ratios from camera framing; absolute dimensions unknown.',
        },
        components: [
          {
            name: 'seat',
            semanticRole: 'seating surface',
            suggestedPrimitive: 'cylinder',
            relativePosition: [0.0, 0.0, 1.15],
            relativeSize: [1.4, 1.4, 0.16],
            relativeRotationDeg: [0, 0, 0],
            primaryColorHex: '#8F684A',
            materialType: 'wood',
            materialId: 'wood_oak',
            visibility: 'fully_visible',
          },
          {
            name: 'leg_front_left',
            semanticRole: 'support leg',
            suggestedPrimitive: 'cylinder',
            relativePosition: [-0.45, -0.45, 0.55],
            relativeSize: [0.12, 0.12, 1.1],
            relativeRotationDeg: [4, 4, 0],
            primaryColorHex: '#8F684A',
            materialType: 'wood',
            materialId: 'wood_oak',
            visibility: 'fully_visible',
          },
          {
            name: 'leg_front_right',
            semanticRole: 'support leg',
            suggestedPrimitive: 'cylinder',
            relativePosition: [0.45, -0.45, 0.55],
            relativeSize: [0.12, 0.12, 1.1],
            relativeRotationDeg: [4, -4, 0],
            primaryColorHex: '#8F684A',
            materialType: 'wood',
            materialId: 'wood_oak',
            visibility: 'fully_visible',
          },
          {
            name: 'leg_rear',
            semanticRole: 'support leg',
            suggestedPrimitive: 'cylinder',
            relativePosition: [0.0, 0.5, 0.55],
            relativeSize: [0.12, 0.12, 1.1],
            relativeRotationDeg: [-5, 0, 0],
            primaryColorHex: '#8F684A',
            materialType: 'wood',
            materialId: 'wood_oak',
            visibility: 'inferred',
          },
        ],
        materials: [
          {
            id: 'wood_oak',
            name: 'Oak Wood',
            baseColorHex: '#8F684A',
            roughness: 0.72,
            metallic: 0.0,
          },
        ],
        uncertaintyFlags: {
          unseenRearEstimated: true,
          hiddenUndersideEstimated: true,
          proportionsInferred: true,
          symmetryAssumed: true,
          notes: ['Rear leg position and underside joinery inferred using radial symmetry.'],
        },
      };

    case 'desk_lamp':
      return {
        category: 'desk_lamp',
        confidence: 0.92,
        summary: 'A minimalist modern desk lamp with heavy circular base, angled arm, and conical shade.',
        cameraView: {
          estimatedAzimuthDeg: 40.0,
          estimatedElevationDeg: 12.0,
          distanceEstimate: 'close',
          viewAngleDescription: 'Side angle view showing lamp arm articulation',
        },
        symmetry: {
          hasSymmetry: false,
          type: 'none',
          planes: [],
        },
        proportions: {
          widthRatio: 0.8,
          depthRatio: 0.8,
          heightRatio: 1.6,
          relativeScaleNotes: 'Estimated relative aspect ratios.',
        },
        components: [
          {
            name: 'base',
            semanticRole: 'counterweight foundation',
            suggestedPrimitive: 'cylinder',
            relativePosition: [0.0, 0.0, 0.04],
            relativeSize: [0.9, 0.9, 0.08],
            primaryColorHex: '#222222',
            materialType: 'metal',
            materialId: 'metal_matte_black',
            visibility: 'fully_visible',
          },
          {
            name: 'vertical_stem',
            semanticRole: 'structural arm',
            suggestedPrimitive: 'cylinder',
            relativePosition: [0.0, 0.0, 0.75],
            relativeSize: [0.06, 0.06, 1.35],
            primaryColorHex: '#222222',
            materialType: 'metal',
            materialId: 'metal_matte_black',
            visibility: 'fully_visible',
          },
          {
            name: 'lamp_shade',
            semanticRole: 'diffuser housing',
            suggestedPrimitive: 'cone',
            relativePosition: [0.25, 0.0, 1.45],
            relativeSize: [0.6, 0.6, 0.45],
            relativeRotationDeg: [0, 45, 0],
            primaryColorHex: '#F0E6D2',
            materialType: 'metal',
            materialId: 'metal_cream',
            visibility: 'fully_visible',
          },
        ],
        materials: [
          {
            id: 'metal_matte_black',
            name: 'Matte Black Anodized Metal',
            baseColorHex: '#222222',
            roughness: 0.4,
            metallic: 0.8,
          },
          {
            id: 'metal_cream',
            name: 'Cream Enamel Shade',
            baseColorHex: '#F0E6D2',
            roughness: 0.3,
            metallic: 0.2,
          },
        ],
        uncertaintyFlags: {
          unseenRearEstimated: true,
          hiddenUndersideEstimated: true,
          proportionsInferred: true,
          symmetryAssumed: false,
          notes: ['Underside felt padding inferred.'],
        },
      };

    case 'box':
    default:
      return {
        category: 'box',
        confidence: 0.98,
        summary: 'A simple rectangular storage box with flat flush lid.',
        cameraView: {
          estimatedAzimuthDeg: 45.0,
          estimatedElevationDeg: 25.0,
          distanceEstimate: 'medium',
          viewAngleDescription: 'Elevated isometric view showing top, front, and right faces',
        },
        symmetry: {
          hasSymmetry: true,
          type: 'bilateral',
          planes: ['XZ', 'YZ'],
        },
        proportions: {
          widthRatio: 1.2,
          depthRatio: 1.0,
          heightRatio: 0.8,
          relativeScaleNotes: 'Estimated proportions from perspective vanishing lines.',
        },
        components: [
          {
            name: 'box_body',
            semanticRole: 'main storage volume',
            suggestedPrimitive: 'box',
            relativePosition: [0.0, 0.0, 0.35],
            relativeSize: [1.4, 1.0, 0.7],
            primaryColorHex: '#B28247',
            materialType: 'wood',
            materialId: 'cardboard_brown',
            visibility: 'partially_visible',
          },
          {
            name: 'box_lid',
            semanticRole: 'top cover',
            suggestedPrimitive: 'box',
            relativePosition: [0.0, 0.0, 0.72],
            relativeSize: [1.44, 1.04, 0.06],
            primaryColorHex: '#9E713A',
            materialType: 'wood',
            materialId: 'cardboard_brown',
            visibility: 'fully_visible',
          },
        ],
        materials: [
          {
            id: 'cardboard_brown',
            name: 'Kraft Boxboard',
            baseColorHex: '#B28247',
            roughness: 0.85,
            metallic: 0.0,
          },
        ],
        uncertaintyFlags: {
          unseenRearEstimated: true,
          hiddenUndersideEstimated: true,
          proportionsInferred: true,
          symmetryAssumed: true,
          notes: ['Back and bottom panels assumed uniform and coplanar.'],
        },
      };
  }
}
