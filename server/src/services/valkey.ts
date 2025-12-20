// Valkey/Redis service for persistent storage
import { Redis } from 'ioredis';

// Key prefixes
const PREFIXES = {
  TOKEN: 'token:',
  SESSION: 'session:',
  USER_TOKENS: 'user:tokens:',
} as const;

// TTL values (in seconds)
const TTL = {
  TOKEN: 90 * 24 * 60 * 60,    // 90 days for OAuth tokens
  SESSION: 30 * 24 * 60 * 60,  // 30 days for sessions
} as const;

// Redis client
let redis: Redis | null = null;

/**
 * Initialize Redis connection. Call this on server startup.
 * Throws if REDIS_URL not configured or connection fails.
 */
export async function initRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required');
  }
  
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    // For rediss:// URLs, enable TLS with relaxed cert validation (needed for Aiven/cloud providers)
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  });
  
  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    redis!.on('ready', () => {
      console.log('Connected to Valkey/Redis');
      resolve();
    });
    redis!.on('error', (err: Error) => {
      reject(new Error(`Redis connection failed: ${err.message}`));
    });
    // Timeout after 10 seconds
    setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
  });
}

/**
 * Get Redis client. Throws if not initialized.
 */
function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not initialized. Call initRedis() first.');
  }
  return redis;
}

// ============= Token Storage =============

export interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  countryCode: string;
  userId: string;
  username?: string;
}

/**
 * Store a token
 */
export async function setToken(hostToken: string, data: StoredToken): Promise<void> {
  const client = getRedis();
  const key = PREFIXES.TOKEN + hostToken;
  await client.setex(key, TTL.TOKEN, JSON.stringify(data));
  
  // Index by userId for cross-device lookup
  if (data.userId) {
    await client.sadd(PREFIXES.USER_TOKENS + data.userId, hostToken);
    await client.expire(PREFIXES.USER_TOKENS + data.userId, TTL.TOKEN);
  }
}

/**
 * Get a token
 */
export async function getToken(hostToken: string): Promise<StoredToken | null> {
  const client = getRedis();
  const key = PREFIXES.TOKEN + hostToken;
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Delete a token
 */
export async function deleteToken(hostToken: string): Promise<void> {
  const client = getRedis();
  
  // Get the token first to find userId
  const token = await getToken(hostToken);
  if (token?.userId) {
    await client.srem(PREFIXES.USER_TOKENS + token.userId, hostToken);
  }
  
  const key = PREFIXES.TOKEN + hostToken;
  await client.del(key);
}

/**
 * Get all tokens for a user (cross-device support)
 */
export async function getTokensForUser(userId: string): Promise<string[]> {
  const client = getRedis();
  return await client.smembers(PREFIXES.USER_TOKENS + userId);
}

/**
 * Find existing token for a user (returns first valid one)
 */
export async function findTokenForUser(userId: string): Promise<string | null> {
  const tokenIds = await getTokensForUser(userId);
  for (const tokenId of tokenIds) {
    const token = await getToken(tokenId);
    if (token && token.expiresAt > Date.now()) {
      return tokenId;
    }
  }
  return null;
}

// ============= Session Storage =============

export interface StoredSession {
  id: string;
  hostId: string;
  hostToken?: string;
  hostName?: string;
  name: string;
  tracks: any[];
  createdAt: string;
  tidalPlaylistId?: string;
  tidalPlaylistUrl?: string;
  isPublic?: boolean;
  userDescription?: string;
}

/**
 * Store a session
 */
export async function setSession(sessionId: string, data: StoredSession): Promise<void> {
  const client = getRedis();
  const key = PREFIXES.SESSION + sessionId;
  await client.setex(key, TTL.SESSION, JSON.stringify(data));
}

/**
 * Get a session
 */
export async function getSession(sessionId: string): Promise<StoredSession | null> {
  const client = getRedis();
  const key = PREFIXES.SESSION + sessionId;
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const client = getRedis();
  const key = PREFIXES.SESSION + sessionId;
  await client.del(key);
}

/**
 * Get all sessions (for listing)
 */
export async function getAllSessions(): Promise<StoredSession[]> {
  const client = getRedis();
  const keys = await client.keys(PREFIXES.SESSION + '*');
  if (keys.length === 0) return [];
  
  const sessions: StoredSession[] = [];
  for (const key of keys) {
    const data = await client.get(key);
    if (data) {
      sessions.push(JSON.parse(data));
    }
  }
  return sessions;
}

/**
 * Refresh session TTL (call on activity)
 */
export async function touchSession(sessionId: string): Promise<void> {
  const client = getRedis();
  const key = PREFIXES.SESSION + sessionId;
  await client.expire(key, TTL.SESSION);
}
