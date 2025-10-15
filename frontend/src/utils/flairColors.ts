import { Model } from '../services/models.service';
import type { LabelProps } from '@patternfly/react-core';

export type Flair = {
  key: keyof Model;
  label: string;
  color: LabelProps['color'];
};

// Central mapping of all special features
// Color scheme avoids conflicts with standard UI status indicators:
// - Blue: Pending Approval status
// - Green: Active/Subscribed status
// - Orange: Restricted Access/Suspended warnings
// - Red: Errors/Denied/Expired status
export const flairs: Flair[] = [
  { key: 'supportsVision', label: 'Vision', color: 'teal' },
  { key: 'supportsFunctionCalling', label: 'Function Calling', color: 'purple' },
  { key: 'supportsParallelFunctionCalling', label: 'Parallel Functions', color: 'yellow' },
  { key: 'supportsToolChoice', label: 'Tool Choice', color: 'grey' },
];

// Helper function that returns the active flairs for a given model
export function getModelFlairs(model: Record<string, any>): Flair[] {
  return flairs.filter(({ key }) => model[key]);
}
