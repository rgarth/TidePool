// OAuth2 Authentication Routes
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import {
  TIDAL_CLIENT_ID,
  TIDAL_CLIENT_SECRET,
  TIDAL_AUTH_BASE,
  TIDAL_TOKEN_URL,
  TIDAL_SCOPES,
  REDIRECT_URI,
  CLIENT_URL,
  getHostAccessToken,
  getHostTokenFromRequest,
  setHostToken,
  getHostToken,
  deleteHostToken,
  findExistingTokenForUser,
} from '../services/tokens.js';
import { PendingAuth } from '../types/index.js';
import * as valkey from '../services/valkey.js';
import { sanitizeDisplayName } from '../utils/sanitize.js';

const router = Router();

// Simple rate limiting for auth endpoints
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT = 10; // max attempts
const AUTH_RATE_WINDOW = 60000; // per minute

function checkAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempt = authAttempts.get(ip);
  
  if (!attempt || now > attempt.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
    return true;
  }
  
  if (attempt.count >= AUTH_RATE_LIMIT) {
    return false;
  }
  
  attempt.count++;
  return true;
}

// PKCE helpers
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Temporary storage for OAuth state (in-memory is fine, short-lived)
export const pendingAuth = new Map<string, PendingAuth>();

// Start OAuth login flow
router.get('/login', (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (!checkAuthRateLimit(clientIp)) {
    console.warn(`Rate limit exceeded for auth from ${clientIp}`);
    return res.status(429).json({ error: 'Too many authentication attempts. Please wait a minute.' });
  }
  
  const { sessionId } = req.query;
  const sessionIdStr = typeof sessionId === 'string' ? sessionId : undefined;
  
  if (!TIDAL_CLIENT_ID) {
    return res.status(500).json({ error: 'Tidal client not configured' });
  }
  
  // Get or create hostToken from cookie
  let hostToken = req.cookies.tidepool_host;
  if (!hostToken) {
    hostToken = nanoid(32);
  }
  
  // Generate PKCE codes
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = nanoid(16);
  
  // Store for callback
  pendingAuth.set(state, { codeVerifier, sessionId: sessionIdStr || '', hostToken });
  
  // Build authorization URL
  const authUrl = new URL(`${TIDAL_AUTH_BASE}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', TIDAL_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', TIDAL_SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  console.log(`Starting OAuth flow${sessionIdStr ? ` for session ${sessionIdStr}` : ''} (host: ${hostToken.substring(0, 8)}...)`);
  res.redirect(authUrl.toString());
});

// OAuth callback handler
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;
  
  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.redirect(`${CLIENT_URL}?auth_error=${encodeURIComponent(String(error_description || error))}`);
  }
  
  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(`${CLIENT_URL}?auth_error=missing_params`);
  }
  
  const pending = pendingAuth.get(state);
  if (!pending) {
    return res.redirect(`${CLIENT_URL}?auth_error=invalid_state`);
  }
  
  pendingAuth.delete(state);
  
  try {
    // Exchange code for tokens
    const credentials = Buffer.from(`${TIDAL_CLIENT_ID}:${TIDAL_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(TIDAL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: pending.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.redirect(`${CLIENT_URL}?auth_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log('Got tokens, fetching user info...');
    
    // Get user info
    let countryCode = 'US';
    let userId = '';
    let username = '';
    
    try {
      const userResponse = await fetch('https://openapi.tidal.com/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.api+json',
        },
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const data = userData.data || userData;
        const attrs = data.attributes || data;
        countryCode = attrs.countryCode || attrs.country || data.countryCode || 'US';
        userId = data.id?.toString() || attrs.userId?.toString() || data.userId?.toString() || '';
        username = sanitizeDisplayName(attrs.username, '', 50);
      }
    } catch (err) {
      console.warn('Failed to fetch user info, using defaults');
    }

    // Check if this user already has a hostToken (from another device)
    let finalHostToken = pending.hostToken;
    if (userId) {
      const existingToken = await findExistingTokenForUser(userId);
      if (existingToken) {
        console.log(`Found existing hostToken for user ${userId}, reusing it`);
        finalHostToken = existingToken;
      }
    }

    // Store/update tokens
    await setHostToken(finalHostToken, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      countryCode,
      userId,
      username,
    });
    
    // Clean up the pending hostToken if we're using a different one
    if (finalHostToken !== pending.hostToken) {
      await deleteHostToken(pending.hostToken);
    }

    console.log(`Authenticated host ${finalHostToken.substring(0, 8)}... (${username})${pending.sessionId ? ` for session ${pending.sessionId}` : ''}`);
    
    // Store hostToken in session if session exists
    if (pending.sessionId) {
      const session = await valkey.getSession(pending.sessionId.toUpperCase());
      if (session) {
        session.hostToken = finalHostToken;
        session.hostName = sanitizeDisplayName(username, 'Host');
        await valkey.setSession(session.id, session);
        console.log(`Stored hostToken in session ${pending.sessionId}`);
      }
    }
    
    // Set persistent cookie
    res.cookie('tidepool_host', finalHostToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    
    // Redirect based on whether there was a sessionId
    if (pending.sessionId) {
      res.redirect(`${CLIENT_URL}/session/${pending.sessionId}?auth=success&token=${finalHostToken}`);
    } else {
      res.redirect(`${CLIENT_URL}/session?auth=success&token=${finalHostToken}`);
    }
    
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${CLIENT_URL}?auth_error=unknown`);
  }
});

// Check auth status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const hostToken = getHostTokenFromRequest(req);
    const tokens = hostToken ? await getHostToken(hostToken) : null;
    
    res.json({
      authenticated: !!tokens,
      expiresAt: tokens?.expiresAt,
      userId: tokens?.userId || null,
      username: tokens?.username || null,
    });
  } catch (err) {
    console.error('Failed to check auth status:', err);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});

// Legacy endpoint for backwards compatibility
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const hostToken = getHostTokenFromRequest(req);
    const tokens = hostToken ? await getHostToken(hostToken) : null;
    res.json({
      authenticated: !!tokens,
      expiresAt: tokens?.expiresAt,
    });
  } catch (err) {
    console.error('Failed to check auth status:', err);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});

// Get credentials for Tidal Player SDK
router.get('/credentials', async (req: Request, res: Response) => {
  try {
    const hostToken = getHostTokenFromRequest(req);
    
    if (!hostToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const auth = await getHostAccessToken(hostToken);
    
    if (!auth) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    const tokens = await getHostToken(hostToken);
    
    res.json({
      clientId: TIDAL_CLIENT_ID,
      accessToken: auth.token,
      expiresAt: tokens?.expiresAt,
      countryCode: auth.countryCode,
    });
  } catch (err) {
    console.error('Failed to get credentials:', err);
    res.status(500).json({ error: 'Failed to get credentials' });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const hostToken = getHostTokenFromRequest(req);
    if (hostToken) {
      await deleteHostToken(hostToken);
    }
    res.clearCookie('tidepool_host');
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to logout:', err);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;
