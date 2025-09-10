export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  issuer: string;
  callbackUrl: string;
  scope: string[];
}

export const oauthConfig: OAuthConfig = {
  clientId: process.env.OAUTH_CLIENT_ID || '',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
  issuer: process.env.OAUTH_ISSUER || '',
  callbackUrl: process.env.OAUTH_CALLBACK_URL || 'http://localhost:8081/api/auth/callback',
  scope: ['openid', 'profile', 'email'],
};
