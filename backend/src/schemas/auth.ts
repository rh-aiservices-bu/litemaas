import { Type } from '@sinclair/typebox';
import { TimestampSchema } from './common';

export const LoginResponseSchema = Type.Object({
  authUrl: Type.String({ format: 'uri' }),
});

export const AuthCallbackQuerySchema = Type.Object({
  code: Type.String(),
  state: Type.String(),
});

export const TokenResponseSchema = Type.Object({
  token: Type.String(),
  expiresIn: Type.Integer(),
  user: Type.Object({
    id: Type.String(),
    username: Type.String(),
    email: Type.String({ format: 'email' }),
    roles: Type.Array(Type.String()),
  }),
});

export const UserProfileSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  email: Type.String({ format: 'email' }),
  fullName: Type.Optional(Type.String()),
  roles: Type.Array(Type.String()),
  createdAt: TimestampSchema,
});

export const JWTPayloadSchema = Type.Object({
  userId: Type.String(),
  username: Type.String(),
  email: Type.String(),
  roles: Type.Array(Type.String()),
  iat: Type.Optional(Type.Integer()),
  exp: Type.Optional(Type.Integer()),
});
