import type { SupportedPrimitiveType } from '../vision/types.ts';

/**
 * Heuristics and rules for mapping semantic object roles and geometric components to supported 3D primitives.
 */
export function determineOptimalPrimitive(
  semanticRole: string,
  suggestedPrimitive?: SupportedPrimitiveType
): SupportedPrimitiveType {
  if (suggestedPrimitive) {
    return suggestedPrimitive;
  }

  const role = semanticRole.toLowerCase();

  // Cylindrical objects (legs, posts, shafts, stems, round seats, bottles)
  if (
    role.includes('leg') ||
    role.includes('pole') ||
    role.includes('shaft') ||
    role.includes('stem') ||
    role.includes('rod') ||
    role.includes('pillar') ||
    role.includes('spindle') ||
    role.includes('cylinder') ||
    role.includes('can')
  ) {
    return 'cylinder';
  }

  // Spherical objects (knobs, bulbs, heads, finials, balls)
  if (
    role.includes('knob') ||
    role.includes('bulb') ||
    role.includes('finial') ||
    role.includes('sphere') ||
    role.includes('ball') ||
    role.includes('orb')
  ) {
    return 'sphere';
  }

  // Conical objects (shades, cones, funnels, tapers)
  if (
    role.includes('shade') ||
    role.includes('cone') ||
    role.includes('funnel') ||
    role.includes('nozzle') ||
    role.includes('taper')
  ) {
    return 'cone';
  }

  // Torus / rings (handles, rims, rings, hoops)
  if (
    role.includes('ring') ||
    role.includes('rim') ||
    role.includes('torus') ||
    role.includes('hoop') ||
    role.includes('donut')
  ) {
    return 'torus';
  }

  // Default to box (panels, table tops, box bodies, seat cushions, backs, shelves)
  return 'box';
}
