import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
import { authService } from '../services/auth.service';
import { useAuth } from '../contexts/AuthContext';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get token from URL fragment
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const rawToken = params.get('token');
        const token = rawToken ? decodeURIComponent(rawToken).trim() : null;
        params.get('expires_in'); // expires_in parameter not used

        if (token) {
          // Store the token (use same token for both access and refresh)
          authService.setTokens(token, token);

          // Refresh user context
          await refreshUser();

          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);

          // Redirect to home
          navigate('/');
        } else {
          console.error('No token found in callback');
          navigate('/login?error=auth_failed');
        }
      } catch (error) {
        console.error('Error handling auth callback:', error);
        navigate('/login?error=auth_failed');
      }
    };

    handleCallback();
  }, [navigate, refreshUser]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}
    >
      <Spinner size="xl" aria-label={t('pages.authCallback.processing')} />
      <p style={{ marginTop: '1rem', textAlign: 'center' }}>{t('pages.authCallback.processing')}</p>
    </div>
  );
};

export default AuthCallbackPage;
