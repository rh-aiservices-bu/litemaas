import React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { StarIcon, OutlinedStarIcon } from '@patternfly/react-icons';

interface StarRatingProps {
  rating: number;
  tooltip: string;
  ariaLabel: string;
}

const TOTAL_STARS = 5;
const FILLED_COLOR = 'var(--pf-t--global--color--status--warning--default)';
const EMPTY_COLOR = 'var(--pf-t--global--color--nonstatus--gray--default)';

const StarRating: React.FC<StarRatingProps> = ({ rating, tooltip, ariaLabel }) => {
  return (
    <Tooltip content={tooltip}>
      <span
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'inline-flex', gap: '2px', alignItems: 'center', cursor: 'default' }}
      >
        {Array.from({ length: TOTAL_STARS }, (_, i) =>
          i < rating ? (
            <StarIcon key={i} color={FILLED_COLOR} />
          ) : (
            <OutlinedStarIcon key={i} color={EMPTY_COLOR} />
          ),
        )}
      </span>
    </Tooltip>
  );
};

export default StarRating;
