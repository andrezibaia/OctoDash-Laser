import { XY } from '../../model';

export type HomeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export const HOME_CORNERS: HomeCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** GRBL settings that decide where the machine coordinates live after homing. */
export interface GrblHoming {
  /** $23 homing direction invert mask (bit 0 = X, bit 1 = Y): set = homes towards the axis minimum */
  dirMask: number;
  /** $130 / $131 maximum travel (mm) */
  maxX: number;
  maxY: number;
  /** $27 homing pull-off (mm) */
  pulloff: number;
  /** grblHAL $22 bit 3: machine position is set to 0 after homing */
  forceOrigin: boolean;
  /** grblHAL (has $4x / $6x settings) — only informative */
  hal: boolean;
}

/** Machine-coordinate rectangle shown on the map and used for jog limits. */
export interface BedGeometry {
  xMin: number;
  yMin: number;
  width: number;
  height: number;
  /** X+ moves the head to the right of the screen */
  xRight: boolean;
  /** Y+ moves the head to the top of the screen (towards the back of the machine) */
  yUp: boolean;
  /** Machine position of the head right after homing */
  home: XY;
  homeCorner: HomeCorner;
  /** Where the numbers came from */
  source: 'grbl' | 'config';
}

export interface BedConfig {
  width: number;
  height: number;
  xMin: number;
  yMin: number;
  yAxisUp: boolean;
  homeCorner?: string;
  auto?: boolean;
}

export function normalizeCorner(corner: string | undefined): HomeCorner {
  return (HOME_CORNERS as string[]).includes(corner) ? (corner as HomeCorner) : 'top-left';
}

/**
 * Parse Better Grbl Support's `grblSettingsText` ("0|10|Step pulse||1|25|…||").
 * Returns null when the homing-relevant settings are missing.
 */
export function parseGrblSettingsText(text: string | null | undefined): GrblHoming | null {
  if (!text || typeof text !== 'string') return null;
  const values = new Map<number, number>();
  for (const entry of text.split('||')) {
    const [key, value] = entry.split('|');
    const n = Number(key);
    const v = Number(value);
    if (key !== '' && Number.isInteger(n) && value !== undefined && value !== '' && !Number.isNaN(v)) {
      values.set(n, v);
    }
  }
  if (!values.has(23) || !values.has(130) || !values.has(131)) return null;
  const hal = [...values.keys()].some(k => (k >= 40 && k <= 99) || k >= 300);
  const homingMask = values.get(22) ?? 1;
  return {
    dirMask: values.get(23) ?? 0,
    maxX: Math.abs(values.get(130)),
    maxY: Math.abs(values.get(131)),
    pulloff: Math.abs(values.get(27) ?? 1),
    forceOrigin: hal && (homingMask & 8) === 8,
    hal,
  };
}

/** Position of one axis after homing, as GRBL / grblHAL compute it. */
function homedAxis(towardsMin: boolean, max: number, pulloff: number, forceOrigin: boolean): number {
  if (forceOrigin) return 0;
  return towardsMin ? -max + pulloff : -pulloff;
}

/**
 * Builds the bed geometry.
 * - With GRBL settings (and `auto` on): size = $130×$131; range and home from $23/$27/$22;
 *   screen orientation from the physical home corner chosen by the user. A position learned
 *   right after a real homing cycle (`learnedHome`) overrides the computed home.
 * - Otherwise: the manual values from the config.
 */
export function computeGeometry(bed: BedConfig, grbl: GrblHoming | null, learnedHome: XY | null = null): BedGeometry {
  const homeCorner = normalizeCorner(bed.homeCorner);
  const homeLeft = homeCorner.endsWith('left');
  const homeTop = homeCorner.startsWith('top');

  if (grbl && bed.auto !== false && grbl.maxX > 0 && grbl.maxY > 0) {
    const xToMin = (grbl.dirMask & 1) === 1;
    const yToMin = (grbl.dirMask & 2) === 2;
    const home = {
      x: learnedHome?.x ?? homedAxis(xToMin, grbl.maxX, grbl.pulloff, grbl.forceOrigin),
      y: learnedHome?.y ?? homedAxis(yToMin, grbl.maxY, grbl.pulloff, grbl.forceOrigin),
    };
    const xMin = xToMin ? home.x - grbl.pulloff : home.x + grbl.pulloff - grbl.maxX;
    const yMin = yToMin ? home.y - grbl.pulloff : home.y + grbl.pulloff - grbl.maxY;
    return {
      xMin: round(xMin),
      yMin: round(yMin),
      width: grbl.maxX,
      height: grbl.maxY,
      // home on the left and homing towards X-min ⇒ X-min is on the left ⇒ X+ goes right
      xRight: homeLeft === xToMin,
      // home at the top and homing towards Y-max ⇒ Y-max is at the top ⇒ Y+ goes up
      yUp: homeTop !== yToMin,
      home: { x: round(home.x), y: round(home.y) },
      homeCorner,
      source: 'grbl',
    };
  }

  const xRight = true;
  const yUp = bed.yAxisUp;
  const home = {
    x: homeLeft === xRight ? bed.xMin : bed.xMin + bed.width,
    y: homeTop === yUp ? bed.yMin + bed.height : bed.yMin,
  };
  return {
    xMin: bed.xMin,
    yMin: bed.yMin,
    width: bed.width,
    height: bed.height,
    xRight,
    yUp,
    home,
    homeCorner,
    source: 'config',
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
