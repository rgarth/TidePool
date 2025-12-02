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
  hostTokens,
  saveTokens,
  getHostAccessToken,
  getHostTokenFromRequest,
} from '../services/tokens.js';
import { PendingAuth } from '../types/index.js';
import { sessions } from './sessions.js';

const router = Router();

// PKCE helpers
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Temporary storage for OAuth state
export const pendingAuth = new Map<string, PendingAuth>();

// Start OAuth login flow
router.get('/login', (req: Request, res: Response) => {
  const { sessionId } = req.query;
  
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID required' });
  }
  
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
  pendingAuth.set(state, { codeVerifier, sessionId, hostToken });
  
  // Build authorization URL
  const authUrl = new URL(`${TIDAL_AUTH_BASE}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', TIDAL_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', TIDAL_SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  console.log(`Starting OAuth flow for session ${sessionId} (host: ${hostToken.substring(0, 8)}...)`);
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
    
    const userUrls = [
      'https://openapi.tidal.com/v2/users/me',
      'https://openapi.tidal.com/users/me',
      'https://api.tidal.com/v1/users/me',
    ];
    
    for (const url of userUrls) {
      console.log(`>>> Trying user info URL: ${url}`);
      const userResponse = await fetch(url, {
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
        console.log(`User country: ${countryCode}, userId: ${userId}`);
        break;
      }
    }

    // Store tokens
    hostTokens.set(pending.hostToken, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      countryCode,
      userId,
    });
    
    saveTokens(hostTokens);

    console.log(`Authenticated host ${pending.hostToken.substring(0, 8)}... for session ${pending.sessionId}`);
    
    // Store hostToken in session so guests can use it
    const session = sessions.get(pending.sessionId.toUpperCase());
    if (session) {
      session.hostToken = pending.hostToken;
      console.log(`Stored hostToken in session ${pending.sessionId}`);
    }
    
    // Set persistent cookie (still useful for same-origin scenarios)
    res.cookie('tidepool_host', pending.hostToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    
    // Also pass token in URL for cross-origin scenarios (incognito, third-party cookie blocking)
    res.redirect(`${CLIENT_URL}/session/${pending.sessionId}?auth=success&token=${pending.hostToken}`);
    
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${CLIENT_URL}?auth_error=unknown`);
  }
});

// Check auth status
router.get('/status', (req: Request, res: Response) => {
  const hostToken = getHostTokenFromRequest(req);
  const tokens = hostToken ? hostTokens.get(hostToken) : null;
  
  res.json({
    authenticated: !!tokens,
    expiresAt: tokens?.expiresAt,
    debug: {
      cookiePresent: !!req.cookies?.tidepool_host,
      headerPresent: !!req.headers['x-host-token'],
      tokensInMemory: hostTokens.size,
    }
  });
});

// Legacy endpoint for backwards compatibility
router.get('/status/:sessionId', (req: Request, res: Response) => {
  const hostToken = getHostTokenFromRequest(req);
  const tokens = hostToken ? hostTokens.get(hostToken) : null;
  res.json({
    authenticated: !!tokens,
    expiresAt: tokens?.expiresAt,
  });
});

// Get credentials for Tidal Player SDK
router.get('/credentials', async (req: Request, res: Response) => {
  const hostToken = getHostTokenFromRequest(req);
  
  if (!hostToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const auth = await getHostAccessToken(hostToken);
  
  if (!auth) {
    return res.status(401).json({ error: 'Session expired' });
  }
  
  const tokens = hostTokens.get(hostToken);
  
  res.json({
    clientId: TIDAL_CLIENT_ID,
    accessToken: auth.token,
    expiresAt: tokens?.expiresAt,
    countryCode: auth.countryCode,
  });
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  const hostToken = getHostTokenFromRequest(req);
  if (hostToken) {
    hostTokens.delete(hostToken);
  }
  res.clearCookie('tidepool_host');
  res.json({ success: true });
});

export default router;

