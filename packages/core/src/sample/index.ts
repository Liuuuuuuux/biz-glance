import { educationSample } from "./education";

const samples = {
  education: educationSample
} as const;

export type SampleName = keyof typeof samples;

export function getSampleDocument(name: SampleName) {
  return structuredClone(samples[name]);
}
