/**
 * Modal Portal Investigation Test
 *
 * This test investigates how PatternFly 6 Modal components render in JSDOM
 * and identifies any portal or rendering issues that affect testing.
 */

import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { Modal, ModalVariant, ModalBody, ModalHeader, Button } from '@patternfly/react-core';

// Simple test component with a modal
const TestModalComponent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal
        variant={ModalVariant.medium}
        title="Test Modal"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        aria-modal="true"
      >
        <ModalHeader title="Test Modal Header" />
        <ModalBody>
          <p>This is modal content for testing</p>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </ModalBody>
      </Modal>
    </>
  );
};

describe('PatternFly 6 Modal Investigation', () => {
  beforeEach(() => {
    // Clear any existing modals from DOM
    document.body.innerHTML = '';
  });

  it('should render modal trigger button', () => {
    render(<TestModalComponent />);

    const button = screen.getByRole('button', { name: /open modal/i });
    expect(button).toBeInTheDocument();
  });

  it('should render modal when opened', async () => {
    const user = userEvent.setup();
    render(<TestModalComponent />);

    // Click to open modal
    const openButton = screen.getByRole('button', { name: /open modal/i });
    await user.click(openButton);

    // Wait for modal to appear and assert
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should have proper ARIA attributes', async () => {
    const user = userEvent.setup();
    render(<TestModalComponent />);

    // Open modal
    const openButton = screen.getByRole('button', { name: /open modal/i });
    await user.click(openButton);

    // Wait for modal
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Check ARIA attributes
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      dialog.getAttribute('aria-labelledby') || dialog.getAttribute('aria-label'),
    ).toBeTruthy();
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<TestModalComponent />);

    // Open modal
    const openButton = screen.getByRole('button', { name: /open modal/i });
    await user.click(openButton);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click the custom close button in modal body (exact text match)
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    const customCloseButton = closeButtons.find((btn) => btn.textContent === 'Close');
    await user.click(customCloseButton!);

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should render modal content', async () => {
    const user = userEvent.setup();
    render(<TestModalComponent />);

    // Open modal
    await user.click(screen.getByRole('button', { name: /open modal/i }));

    // Wait for and verify modal content
    await waitFor(() => {
      expect(screen.getByText(/this is modal content/i)).toBeInTheDocument();
    });
  });
});
