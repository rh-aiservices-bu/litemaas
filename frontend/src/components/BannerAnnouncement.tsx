import React from 'react';
import { Banner, Button, Flex, FlexItem } from '@patternfly/react-core';
import { TimesIcon, ExternalLinkAltIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useBanners } from '../contexts/BannerContext';
import { useAuth } from '../contexts/AuthContext';
import Markdown from 'react-markdown';

interface BannerAnnouncementProps {
  className?: string;
}

export const BannerAnnouncement: React.FC<BannerAnnouncementProps> = ({ className }) => {
  const { i18n } = useTranslation();
  const { banners, dismissBanner } = useBanners();
  const { isAuthenticated } = useAuth();

  // Don't show banner if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Get the highest priority active banner
  const activeBanner = banners.find((banner) => banner.isActive);

  if (!activeBanner) {
    return null;
  }

  // Get content in current language with fallback to English
  const content = activeBanner.content[i18n.language] || activeBanner.content['en'] || '';

  // Get link text in current language
  const linkText = activeBanner.linkText?.[i18n.language] || activeBanner.linkText?.['en'];

  // Handle banner dismissal
  const handleDismiss = async () => {
    try {
      await dismissBanner(activeBanner.id);
    } catch (error) {
      console.error('Failed to dismiss banner:', error);
    }
  };

  // Render markdown or plain text
  const renderContent = () => {
    if (activeBanner.markdownEnabled) {
      return <Markdown>{content}</Markdown>;
    }
    return <span>{content}</span>;
  };

  // Render external link if provided
  const renderLink = () => {
    if (!activeBanner.linkUrl) {
      return null;
    }

    return (
      <Button
        variant="link"
        isInline
        icon={<ExternalLinkAltIcon />}
        iconPosition="end"
        component="a"
        href={activeBanner.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pf-v6-u-ml-sm"
      >
        {linkText || 'Learn more'}
      </Button>
    );
  };

  // Map our banner variants to PatternFly CSS classes
  const getBannerVariantClass = (variant: string) => {
    switch (variant) {
      case 'danger':
        return 'pf-m-red';
      case 'success':
        return 'pf-m-green';
      case 'warning':
        return 'pf-m-orange';
      case 'info':
        return 'pf-m-blue';
      case 'default':
      default:
        return '';
    }
  };

  return (
    <Banner
      data-testid="banner-announcement"
      className={`pf-v6-u-position-sticky pf-v6-u-top-0 pf-v6-u-z-index-300 ${getBannerVariantClass(activeBanner.variant)} ${className || ''}`}
      screenReaderText="System announcement"
    >
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsNone' }}>
        <FlexItem flex={{ default: 'flex_1' }}>
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            justifyContent={{ default: 'justifyContentCenter' }}
            spaceItems={{ default: 'spaceItemsSm' }}
          >
            <FlexItem>{renderContent()}</FlexItem>
            {renderLink() && <FlexItem>{renderLink()}</FlexItem>}
          </Flex>
        </FlexItem>
        {activeBanner.isDismissible && (
          <FlexItem>
            <Button
              variant="plain"
              aria-label="Dismiss announcement"
              onClick={handleDismiss}
              icon={<TimesIcon />}
            />
          </FlexItem>
        )}
      </Flex>
    </Banner>
  );
};

// Helper component for rendering banner content with markdown support

export default BannerAnnouncement;
