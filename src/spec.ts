export type WEQ8Spec = [
  WEQ8Filter,
  WEQ8Filter,
  WEQ8Filter,
  WEQ8Filter,
  WEQ8Filter,
  WEQ8Filter,
  WEQ8Filter,
  WEQ8Filter
];

export type FilterType =
  | "lowpass12"
  | "lowpass24"
  | "highpass12"
  | "highpass24"
  | "bandpass12"
  | "bandpass24"
  | "lowshelf12"
  | "lowshelf24"
  | "highshelf12"
  | "highshelf24"
  | "peaking12"
  | "peaking24"
  | "notch12"
  | "notch24";
export const FILTER_TYPES: FilterType[] = [
  "lowpass12",
  "lowpass24",
  "highpass12",
  "highpass24",
  "bandpass12",
  "bandpass24",
  "lowshelf12",
  "lowshelf24",
  "highshelf12",
  "highshelf24",
  "peaking12",
  "peaking24",
  "notch12",
  "notch24",
];

export type WEQ8Filter = {
  type: FilterType | "noop";
  frequency: number;
  Q: number;
  gain: number;
  bypass: boolean;
};

export const DEFAULT_SPEC: WEQ8Spec = [
  { type: "lowshelf12", frequency: 30, gain: 0, Q: 0.7, bypass: false },
  { type: "peaking12", frequency: 200, gain: 0, Q: 0.7, bypass: false },
  { type: "peaking12", frequency: 1000, gain: 0, Q: 0.7, bypass: false },
  { type: "highshelf12", frequency: 5000, gain: 0, Q: 0.7, bypass: false },
  { type: "noop", frequency: 350, gain: 0, Q: 1, bypass: false },
  { type: "noop", frequency: 350, gain: 0, Q: 1, bypass: false },
  { type: "noop", frequency: 350, gain: 0, Q: 1, bypass: false },
  { type: "noop", frequency: 350, gain: 0, Q: 1, bypass: false },
];
