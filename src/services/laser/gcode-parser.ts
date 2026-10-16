import { Bounds, ParsedGcode } from '../../model';

export interface GcodeParseOptions {
  rapidFeed: number;
  /** Consecutive segments with the same laser state are merged until this length (mm). */
  minSegmentLength?: number;
  /** Yield to the UI every N lines. */
  chunkLines?: number;
}

function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function extend(b: Bounds, x: number, y: number): void {
  if (x < b.minX) b.minX = x;
  if (x > b.maxX) b.maxX = x;
  if (y < b.minY) b.minY = y;
  if (y > b.maxY) b.maxY = y;
}

function finalBounds(b: Bounds): Bounds | null {
  return Number.isFinite(b.minX) ? b : null;
}

/**
 * Small G-code reader for GRBL laser files (G0/G1/G2/G3, G90/G91, G20/G21, M3/M4/M5, S, F).
 * Produces drawing segments, bounds, a time estimate and byte offsets for progress mapping.
 * Runs in chunks so the UI stays responsive on a Raspberry Pi.
 */
export async function parseGcode(text: string, options: GcodeParseOptions): Promise<ParsedGcode> {
  const minLen = options.minSegmentLength ?? 0.1;
  const chunk = options.chunkLines ?? 20000;
  const rapid = Math.max(options.rapidFeed, 1);

  let absolute = true;
  let scale = 1; // mm per unit
  let motion = 0;
  let laserOn = false;
  let s = 0;
  let feed = 0;
  let x = 0;
  let y = 0;

  const burnBounds = emptyBounds();
  const moveBounds = emptyBounds();
  const segs: number[] = [];
  const offs: number[] = [];
  let seconds = 0;
  let powerMin = Infinity;
  let powerMax = -Infinity;
  let passes = 0;
  let lineCount = 0;

  // pending merged segment
  let px0 = 0;
  let py0 = 0;
  let px1 = 0;
  let py1 = 0;
  let pBurn = -1;
  let pLen = 0;
  let pOff = 0;

  const flush = () => {
    if (pBurn < 0) return;
    segs.push(px0, py0, px1, py1, pBurn);
    offs.push(pOff);
    pBurn = -1;
    pLen = 0;
  };

  const addSegment = (x0: number, y0: number, x1: number, y1: number, burn: number, offset: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len === 0) return;
    if (pBurn === burn && pLen < minLen && px1 === x0 && py1 === y0) {
      px1 = x1;
      py1 = y1;
      pLen += len;
      pOff = offset;
      return;
    }
    flush();
    px0 = x0;
    py0 = y0;
    px1 = x1;
    py1 = y1;
    pBurn = burn;
    pLen = len;
    pOff = offset;
  };

  const wordRe = /([A-Z])\s*([-+]?\d*\.?\d+)/g;
  let pos = 0;
  const total = text.length;

  while (pos < total) {
    let end = text.indexOf('\n', pos);
    if (end < 0) end = total;
    let line = text.substring(pos, end);
    pos = end + 1;
    lineCount++;

    if (lineCount % chunk === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // comments: ; ... and ( ... )
    const semi = line.indexOf(';');
    let comment = '';
    if (semi >= 0) {
      comment = line.substring(semi + 1);
      line = line.substring(0, semi);
    }
    if (line.indexOf('(') >= 0) {
      line = line.replace(/\(([^)]*)\)/g, (_m, c) => {
        comment += ' ' + c;
        return ' ';
      });
    }
    if (comment) {
      const pass = comment.match(/pass\s*#?\s*(\d+)/i);
      if (pass) passes = Math.max(passes, Number(pass[1]));
    }

    line = line.toUpperCase();
    if (!line.trim() || line.trimStart().startsWith('$')) continue;

    let nx: number = null;
    let ny: number = null;
    let i: number = null;
    let j: number = null;

    wordRe.lastIndex = 0;
    let m: RegExpExecArray;
    while ((m = wordRe.exec(line)) !== null) {
      const letter = m[1];
      const value = parseFloat(m[2]);
      switch (letter) {
        case 'G':
          switch (value) {
            case 0:
            case 1:
            case 2:
            case 3:
              motion = value;
              break;
            case 90:
              absolute = true;
              break;
            case 91:
              absolute = false;
              break;
            case 20:
              scale = 25.4;
              break;
            case 21:
              scale = 1;
              break;
            default:
              break;
          }
          break;
        case 'M':
          if (value === 3 || value === 4) laserOn = true;
          else if (value === 5 || value === 2 || value === 30) laserOn = false;
          break;
        case 'S':
          s = value;
          break;
        case 'F':
          feed = value * scale;
          break;
        case 'X':
          nx = value * scale;
          break;
        case 'Y':
          ny = value * scale;
          break;
        case 'I':
          i = value * scale;
          break;
        case 'J':
          j = value * scale;
          break;
        default:
          break;
      }
    }

    if (nx === null && ny === null) {
      continue;
    }

    const tx = nx === null ? x : absolute ? nx : x + nx;
    const ty = ny === null ? y : absolute ? ny : y + ny;
    const burn = motion !== 0 && laserOn && s > 0 ? 1 : 0;
    const offset = pos;

    if (motion === 2 || motion === 3) {
      const cx = x + (i ?? 0);
      const cy = y + (j ?? 0);
      const r = Math.hypot(x - cx, y - cy);
      const a0 = Math.atan2(y - cy, x - cx);
      let a1 = Math.atan2(ty - cy, tx - cx);
      if (motion === 2) {
        if (a1 >= a0) a1 -= 2 * Math.PI;
      } else if (a1 <= a0) {
        a1 += 2 * Math.PI;
      }
      if (Math.abs(tx - x) < 1e-9 && Math.abs(ty - y) < 1e-9) {
        // full circle
        a1 = motion === 2 ? a0 - 2 * Math.PI : a0 + 2 * Math.PI;
      }
      const sweep = Math.abs(a1 - a0);
      const arcLen = sweep * r;
      const steps = Math.min(64, Math.max(4, Math.ceil(arcLen / 1)));
      let lx = x;
      let ly = y;
      for (let k = 1; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps;
        const ax = k === steps ? tx : cx + r * Math.cos(a);
        const ay = k === steps ? ty : cy + r * Math.sin(a);
        addSegment(lx, ly, ax, ay, burn, offset);
        extend(moveBounds, ax, ay);
        if (burn) extend(burnBounds, ax, ay);
        lx = ax;
        ly = ay;
      }
      seconds += feed > 0 ? (arcLen / feed) * 60 : 0;
    } else {
      const len = Math.hypot(tx - x, ty - y);
      addSegment(x, y, tx, ty, burn, offset);
      extend(moveBounds, x, y);
      extend(moveBounds, tx, ty);
      if (burn) {
        extend(burnBounds, x, y);
        extend(burnBounds, tx, ty);
      }
      seconds += motion === 0 ? (len / rapid) * 60 : feed > 0 ? (len / feed) * 60 : 0;
    }

    if (burn) {
      if (s < powerMin) powerMin = s;
      if (s > powerMax) powerMax = s;
    }

    x = tx;
    y = ty;
  }
  flush();

  return {
    burnBounds: finalBounds(burnBounds),
    moveBounds: finalBounds(moveBounds),
    segments: Float32Array.from(segs),
    offsets: Float64Array.from(offs),
    segmentCount: offs.length,
    estimatedSeconds: seconds,
    powerMin: Number.isFinite(powerMin) ? powerMin : 0,
    powerMax: Number.isFinite(powerMax) ? powerMax : 0,
    passes,
    lines: lineCount,
    bytes: total,
  };
}

/** Index of the last segment whose line ends at or before the given byte position. */
export function segmentIndexAt(parsed: ParsedGcode, filepos: number): number {
  const offsets = parsed.offsets;
  let lo = 0;
  let hi = offsets.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= filepos) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}
