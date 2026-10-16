export interface JobStatus {
  file: string;
  fullPath: string;
  progress: number;
  zHeight: number | ZHeightLayer;
  filamentAmount?: number;
  timePrinted: Duration;
  timeLeft?: Duration;
  estimatedPrintTime?: Duration;
  estimatedEndTime?: string;
  filepos?: number;
  fileSize?: number;
  printTimeSeconds?: number;
  printTimeLeftSeconds?: number;
}

export interface Duration {
  value: string;
  unit: string;
}

export interface ZHeightLayer {
  current: number;
  total: number;
}
