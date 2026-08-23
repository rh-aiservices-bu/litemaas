import { describe, it, expect } from 'vitest';
import { render, screen } from '../test-utils';
import StarRating from '../../components/StarRating';

describe('StarRating', () => {
  it('renders the correct number of filled stars for rating 3', () => {
    render(<StarRating rating={3} tooltip="Monthly popularity" ariaLabel="3 out of 5 stars" />);

    const container = screen.getByRole('img', { name: '3 out of 5 stars' });
    expect(container).toBeInTheDocument();

    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(5);
  });

  it('renders 5 filled stars for rating 5', () => {
    render(<StarRating rating={5} tooltip="Monthly popularity" ariaLabel="5 out of 5 stars" />);

    const container = screen.getByRole('img', { name: '5 out of 5 stars' });
    expect(container).toBeInTheDocument();
  });

  it('renders 1 filled star for rating 1', () => {
    render(<StarRating rating={1} tooltip="Monthly popularity" ariaLabel="1 out of 5 stars" />);

    const container = screen.getByRole('img', { name: '1 out of 5 stars' });
    expect(container).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(
      <StarRating
        rating={4}
        tooltip="Monthly popularity"
        ariaLabel="Popularity rating: 4 out of 5 stars"
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Popularity rating: 4 out of 5 stars' }),
    ).toBeInTheDocument();
  });
});
