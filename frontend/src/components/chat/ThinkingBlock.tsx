import React from 'react';
import { ExpandableSection } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import './ThinkingBlock.css';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content, isStreaming = false }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(isStreaming);

  React.useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    }
  }, [isStreaming]);

  return (
    <div className="thinking-block">
      <ExpandableSection
        toggleText={
          isStreaming
            ? t('pages.chatbot.thinking.thinkingInProgress')
            : t('pages.chatbot.thinking.thought')
        }
        onToggle={(_event, expanded) => setIsExpanded(expanded)}
        isExpanded={isExpanded}
        className="thinking-block__expandable"
      >
        <div className="thinking-block__content">{content}</div>
      </ExpandableSection>
    </div>
  );
};

export default ThinkingBlock;
