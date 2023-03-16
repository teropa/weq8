import { FilterType } from "src/spec";

export const TYPE_OPTIONS: [FilterType | "noop", string][] = [
  ["noop", "Add +"],
  ["lowpass12", "LP12"],
  ["lowpass24", "LP24"],
  ["highpass12", "HP12"],
  ["highpass24", "HP24"],
  ["lowshelf12", "LS12"],
  ["lowshelf24", "LS24"],
  ["highshelf12", "HS12"],
  ["highshelf24", "HS24"],
  ["peaking12", "PK12"],
  ["peaking24", "PK24"],
  ["notch12", "NT12"],
  ["notch24", "NT24"],
];
