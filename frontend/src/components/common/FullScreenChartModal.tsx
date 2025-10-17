import React from 'react';
import { Modal, ModalVariant, ModalBody, ModalHeader } from '@patternfly/react-core';

export interface FullScreenChartModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Chart or content to display in full screen */
  children: React.ReactNode;
}

/**
 * FullScreenChartModal Component
 *
 * A reusable modal component for displaying charts and content in near full-screen view.
 * Uses PatternFly 6 Modal with large variant and 95% width for maximum visibility.
 *
 * Features:
 * - Near full-screen display (95% width)
 * - Built-in close button in header (provided by PatternFly Modal)
 * - ESC key support (built into Modal)
 * - Focus management and accessibility
 * - Responsive to different screen sizes
 *
 * @example
 * ```tsx
 * <FullScreenChartModal
 *   isOpen={isExpanded}
 *   onClose={() => setIsExpanded(false)}
 *   title="Usage Trends"
 * >
 *   <UsageTrends data={data} height={600} description="Detailed view of usage trends over time" />
 * </FullScreenChartModal>
 * ```
 */
const FullScreenChartModal: React.FC<FullScreenChartModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  return (
    <Modal
      variant={ModalVariant.large}
      isOpen={isOpen}
      onClose={onClose}
      aria-label={title}
      width="95%"
    >
      <ModalHeader title={title} labelId="fullscreen-modal-title" />
      <ModalBody>{children}</ModalBody>
    </Modal>
  );
};

export default FullScreenChartModal;
