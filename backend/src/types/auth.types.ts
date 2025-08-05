import { FastifyRequest } from 'fastify';

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuthUserInfo {
  sub: string;
  name?: string;
  preferred_username: string;
  email: string;
  email_verified?: boolean;
  groups?: string[];
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
}

export interface LoginResponse {
  authUrl: string;
}

export interface AuthCallbackParams {
  code: string;
  state: string;
}

export interface TokenResponse {
  token: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email: string;
    roles: string[];
  };
}
