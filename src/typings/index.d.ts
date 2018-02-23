declare module "*.json" {
  const value: any;
  export default value;
}


interface RegionStats {
  name: string;
  earthquak_count: number;
  total_magnitude: number;
}

interface EarthquakeProperties {
  mag: number;
  place: string;
  time: number;
  updated: number;
  tz: number;
  url: string;
  detail: string;
  felt: number;
  cdi: number;
  mmi: number;
  alert: string;
  status: string;
  tsunami: number;
  sig: number;
  net: string;
  code: string;
  ids: string;
  sources: string;
  types: string;
  nst: number;
  dmin: number;
  rms: number;
  gap: number;
  magType: string;
  type: string;
}
