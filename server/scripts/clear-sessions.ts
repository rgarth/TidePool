// One-time script to clear all sessions from Valkey
// Run with: npx ts-node scripts/clear-sessions.ts

import { config } from 'dotenv';
config(); // Load .env

import { Redis } from 'ioredis';

async function clearSessions() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('REDIS_URL environment variable is required');
    process.exit(1);
  }
  
  console.log('Connecting to Valkey/Redis...');
  const redis = new Redis(redisUrl, {
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  });
  
  await new Promise<void>((resolve, reject) => {
    redis.on('ready', () => resolve());
    redis.on('error', (err) => reject(err));
    setTimeout(() => reject(new Error('Connection timeout')), 10000);
  });
  
  console.log('Connected. Finding session keys...');
  const keys = await redis.keys('session:*');
  
  if (keys.length === 0) {
    console.log('No sessions found.');
  } else {
    console.log(`Found ${keys.length} sessions. Deleting...`);
    await redis.del(...keys);
    console.log(`Deleted ${keys.length} sessions.`);
  }
  
  await redis.quit();
  console.log('Done.');
}

clearSessions().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

