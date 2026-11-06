export interface ForecastWeatherFrame {
  /** Eastward / northward wind at that timestamp, m/s. */
  u: (number | null)[];
  v: (number | null)[];
  rasterUrl: string;
  rainWindowEndAt: string;
}

export interface ForecastWeather {
  /** Trusted public bucket chosen by the reader, never taken from remote JSON. */
  publicationBase?: string;
  rainNumeric?: boolean;
  source: string;
  model: 'ecmwf_ifs';
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
  bounds: { west: number; east: number; south: number; north: number };
  rows: number;
  cols: number;
  latitude: number[];
  longitude: number[];
  sampleSpacingDegrees: number;
  times: string[];
  frames: ForecastWeatherFrame[];
  rainUnit: 'mm';
  windUnit: 'm/s';
  rainResolutionDegrees: number;
  nativeIntervalHours: number;
  issuedAt: string;
}
