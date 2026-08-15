import { Router } from 'express';
import {
  registerSchema,
  loginSchema,
  oauthSchema,
  refreshSchema,
} from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { authLimiter } from '../middleware/rateLimit';
import { verifyRefreshToken } from '../utils/jwt';
import {
  register,
  login,
  oauthAuthenticate,
  refresh,
} from '../services/authService';
import type { OAuthNeedsProfileResponse } from '@village-wars/shared';

export const authRouter = Router();

authRouter.use(authLimiter);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await register(input);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.json(result);
  }),
);

async function handleOAuth(provider: 'apple' | 'google', body: unknown) {
  const input = oauthSchema.parse(body);
  return oauthAuthenticate(provider, input);
}

authRouter.post(
  '/oauth/google',
  asyncHandler(async (req, res) => {
    const result = await handleOAuth('google', req.body);
    if (result.kind === 'needs_profile') {
      const body: OAuthNeedsProfileResponse = {
        needsProfile: true,
        provider: result.provider,
        email: result.email,
      };
      res.status(200).json(body);
      return;
    }
    res.json(result.response);
  }),
);

authRouter.post(
  '/oauth/apple',
  asyncHandler(async (req, res) => {
    const result = await handleOAuth('apple', req.body);
    if (result.kind === 'needs_profile') {
      const body: OAuthNeedsProfileResponse = {
        needsProfile: true,
        provider: result.provider,
        email: result.email,
      };
      res.status(200).json(body);
      return;
    }
    res.json(result.response);
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const payload = verifyRefreshToken(refreshToken);
    const result = await refresh(payload.sub);
    res.json(result);
  }),
);
