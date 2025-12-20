// Token persistence and management
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { UserTokens } from '../types/index.js';

// Load dotenv BEFORE reading any env vars (ES modules hoist imports, so this must be here)
dotenv.config();

// Token persistence file (for development - survives server restarts)
const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');

// Load tokens from disk on startup
export function loadTokens(): Map<string, UserTokens> {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      console.log(`Loaded ${Object.keys(data).length} tokens from disk`);
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load tokens:', e);
  }
  return new Map();
}

// Save tokens to disk
export function saveTokens(tokens: Map<string, UserTokens>): void {
  try {
    const data = Object.fromEntries(tokens);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save tokens:', e);
  }
}

// Host tokens storage (loaded from disk on startup)
export const hostTokens = loadTokens();

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

// Refresh access token
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
    // 400/401 typically means refresh token is invalid or expired
    if (response.status === 400 || response.status === 401) {
      throw new TokenExpiredError('OAuth session has expired. The host needs to re-authenticate.');
    }
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return response.json();
}

// Get host's access token (with auto-refresh)
export async function getHostAccessToken(hostToken: string): Promise<{ token: string; countryCode: string; userId: string } | null> {
  const tokens = hostTokens.get(hostToken);
  if (!tokens) {
    return null;
  }
  
  // Refresh if expired (with 5 min buffer)
  if (tokens.expiresAt < Date.now() + 300000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      hostTokens.set(hostToken, {
        ...tokens,
        accessToken: refreshed.access_token,
        expiresAt: Date.now() + refreshed.expires_in * 1000,
      });
      saveTokens(hostTokens);
      return { token: refreshed.access_token, countryCode: tokens.countryCode, userId: tokens.userId };
    } catch (err) {
      console.error('Failed to refresh token:', err);
      hostTokens.delete(hostToken);
      saveTokens(hostTokens);
      // Re-throw TokenExpiredError so callers can handle it specially
      if (err instanceof TokenExpiredError) {
        throw err;
      }
      return null;
    }
  }
  
  return { token: tokens.accessToken, countryCode: tokens.countryCode, userId: tokens.userId };
}

// Extract host token from request (cookie OR header)
// Header takes precedence (for cross-origin scenarios with third-party cookie blocking)
import { Request } from 'express';

export function getHostTokenFromRequest(req: Request): string | undefined {
  // Check header first (X-Host-Token)
  const headerToken = req.headers['x-host-token'];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }
  
  // Fall back to cookie
  return req.cookies?.tidepool_host;
}

