// Token management with Valkey/Redis
import dotenv from 'dotenv';
import { Request } from 'express';
import { UserTokens } from '../types/index.js';
import * as valkey from './valkey.js';

// Load dotenv
dotenv.config();

// Tidal configuration
export const TIDAL_CLIENT_ID = process.env.TIDAL_CLIENT_ID;
export const TIDAL_CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET;
export const TIDAL_AUTH_BASE = 'https://login.tidal.com';
export const TIDAL_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
export const TIDAL_API_URL = 'https://openapi.tidal.com';
export const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3001/api/auth/callback';
export const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

// OAuth scopes
export const TIDAL_SCOPES = [
  'user.read',
  'search.read',
  'playlists.read',
  'playlists.write',
].join(' ');

// Custom error for expired/invalid refresh tokens
export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

/**
 * Set a host token
 */
export async function setHostToken(hostToken: string, data: UserTokens): Promise<void> {
  await valkey.setToken(hostToken, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    countryCode: data.countryCode,
    userId: data.userId,
    username: data.username,
  });
}

/**
 * Get a host token
 */
export async function getHostToken(hostToken: string): Promise<UserTokens | null> {
  return await valkey.getToken(hostToken);
}

/**
 * Delete a host token
 */
export async function deleteHostToken(hostToken: string): Promise<void> {
  await valkey.deleteToken(hostToken);
}

/**
 * Find all tokens for a user (cross-device support)
 */
export async function getTokensForUser(userId: string): Promise<string[]> {
  return await valkey.getTokensForUser(userId);
}

/**
 * Find existing token for a user (for token reuse on new device)
 */
export async function findExistingTokenForUser(userId: string): Promise<string | null> {
  return await valkey.findTokenForUser(userId);
}

/**
 * Refresh access token with Tidal
 */
export async function refreshAccessToken(refreshToken: string): Promise<any> {
  const credentials = Buffer.from(`${TIDAL_CLIENT_ID}:${TIDAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(TIDAL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new TokenExpiredError('OAuth session has expired. The host needs to re-authenticate.');
    }
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get host's access token (with auto-refresh)
 */
export async function getHostAccessToken(hostToken: string): Promise<{ token: string; countryCode: string; userId: string } | null> {
  const tokens = await getHostToken(hostToken);
  if (!tokens) {
    return null;
  }
  
  // Refresh if expired (with 5 min buffer)
  if (tokens.expiresAt < Date.now() + 300000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      const updated: UserTokens = {
        ...tokens,
        accessToken: refreshed.access_token,
        expiresAt: Date.now() + refreshed.expires_in * 1000,
      };
      await setHostToken(hostToken, updated);
      return { token: refreshed.access_token, countryCode: tokens.countryCode, userId: tokens.userId };
    } catch (err) {
      console.error('Failed to refresh token:', err);
      await deleteHostToken(hostToken);
      if (err instanceof TokenExpiredError) {
        throw err;
      }
      return null;
    }
  }
  
  return { token: tokens.accessToken, countryCode: tokens.countryCode, userId: tokens.userId };
}

/**
 * Extract host token from request (cookie OR header)
 */
export function getHostTokenFromRequest(req: Request): string | undefined {
  const headerToken = req.headers['x-host-token'];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }
  return req.cookies?.tidepool_host;
}
