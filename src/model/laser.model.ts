export enum LaserState {
  offline = 'offline',
  connecting = 'connecting',
  idle = 'idle',
  running = 'running',
  paused = 'paused',
  jogging = 'jogging',
  homing = 'homing',
  alarm = 'alarm',
  door = 'door',
  sleep = 'sleep',
  check = 'check',
  unknown = 'unknown',
}

export interface XY {
  x: number;
  y: number;
}

export interface LaserStatus {
  state: LaserState;
  /** Raw GRBL state as reported (e.g. "Hold:0", "Alarm") */
  grblState: string;
  /** Machine position (MPos) — null until known */
  mpos: XY | null;
  /** Work position (WPos) — null until known */
  wpos: XY | null;
  /** Work coordinate offset (WCO = MPos - WPos) */
  wco: XY;
  /** Whether a WCO report was ever received */
  wcoKnown: boolean;
  feed: number;
  power: number;
  airAssist: boolean;
  /** OctoPrint is streaming a job (printing or paused) */
  jobActive: boolean;
  /** Last GRBL alarm code seen (ALARM:n), null when not in alarm */
  alarmCode: number | null;
  /** OctoPrint is waiting for the current line to finish before pausing */
  pausing: boolean;
  updated: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ParsedGcode {
  /** Bounds of all laser-on (burning) moves, in work coordinates */
  burnBounds: Bounds | null;
  /** Bounds of every XY move, in work coordinates */
  moveBounds: Bounds | null;
  /**
   * Flat list of polyline segments: [x0, y0, x1, y1, burn(0/1), ...] in work coordinates.
   * Long files are decimated, so this is for drawing only.
   */
  segments: Float32Array;
  /** Byte offset in the file where each segment's line ends (same index as segments/5) */
  offsets: Float64Array;
  segmentCount: number;
  /** Estimated duration in seconds (no acceleration model) */
  estimatedSeconds: number;
  /** Min/max S value of burning moves */
  powerMin: number;
  powerMax: number;
  /** Number of passes, when the generator marks them (best effort, 0 = unknown) */
  passes: number;
  lines: number;
  bytes: number;
}

export interface LaserJobFile {
  /** OctoPrint path including origin, e.g. "/local/folder/file.gcode" */
  path: string;
  name: string;
  display: string;
  size: number;
  date: number;
  downloadUrl: string;
}
