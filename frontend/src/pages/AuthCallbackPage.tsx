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
        const expiresInStr = params.get('expires_in');

        if (token) {
          // Store the token (use same token for both access and refresh)
          authService.setTokens(token, token);

          // Store token expiration for session timeout detection
          if (expiresInStr) {
            const expiresIn = parseInt(expiresInStr, 10);
            if (!isNaN(expiresIn) && expiresIn > 0) {
              const expiresAt = Date.now() + expiresIn * 1000;
              localStorage.setItem('token_expires_at', expiresAt.toString());
            }
          }

          // Refresh user context
          await refreshUser();

          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);

          // Restore return URL for deep linking, default to home
          const returnUrl = sessionStorage.getItem('returnUrl') || '/';
          sessionStorage.removeItem('returnUrl');
          navigate(returnUrl);
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
