import { Model } from '../services/models.service';
import type { LabelProps } from '@patternfly/react-core';

export type Flair = {
  key: keyof Model;
  label: string;
  color: LabelProps['color'];
};

// Central mapping of all special features
export const flairs: Flair[] = [
  { key: 'supportsVision', label: 'Vision', color: 'blue' },
  { key: 'supportsFunctionCalling', label: 'Function Calling', color: 'green' },
  { key: 'supportsParallelFunctionCalling', label: 'Parallel Functions', color: 'purple' },
  { key: 'supportsToolChoice', label: 'Tool Choice', color: 'orange' },
];

// Helper function that returns the active flairs for a given model
export function getModelFlairs(model: Record<string, any>): Flair[] {
  return flairs.filter(({ key }) => model[key]);
}
