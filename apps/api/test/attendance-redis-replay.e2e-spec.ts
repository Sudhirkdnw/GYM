import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../src/common/redis/redis.service';

describe('Stage 2.7 Step 3: Live Redis Atomic Nonce Replay Integration Test', () => {
  let redisService: RedisService;
  let configService: ConfigService;

  const orgAlpha = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const orgBeta = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeAll(async () => {
    configService = new ConfigService({
      redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    });

    redisService = new RedisService(configService);
    await redisService.onModuleInit();
  });

  afterAll(async () => {
    await redisService.onModuleDestroy();
  });

  it('should verify live Redis connectivity', async () => {
    const isHealthy = await redisService.isHealthy();
    expect(isHealthy).toBe(true);
  });

  it('should atomically acquire a fresh nonce and reject replay on second call', async () => {
    const nonce = crypto.randomBytes(12).toString('hex');

    // 1. First presentation -> ACQUIRED
    const result1 = await redisService.consumeNonce(orgAlpha, nonce, 180);
    expect(result1).toBe('ACQUIRED');

    // 2. Immediate second presentation -> REPLAY_DETECTED
    const result2 = await redisService.consumeNonce(orgAlpha, nonce, 180);
    expect(result2).toBe('REPLAY_DETECTED');

    // Verify key TTL in Redis
    const client = redisService.getClient();
    const ttl = await client.ttl(`attendance:nonce:${orgAlpha}:${nonce}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(180);

    // Teardown
    await redisService.deleteNonce(orgAlpha, nonce);
  });

  it('should isolate nonces between different organizations', async () => {
    const sharedNonce = crypto.randomBytes(12).toString('hex');

    // Acquire in Org Alpha
    const alphaResult = await redisService.consumeNonce(orgAlpha, sharedNonce, 180);
    expect(alphaResult).toBe('ACQUIRED');

    // Same nonce acquired in Org Beta should succeed (isolated keys)
    const betaResult = await redisService.consumeNonce(orgBeta, sharedNonce, 180);
    expect(betaResult).toBe('ACQUIRED');

    // Replay in Org Alpha should still be detected
    const alphaReplay = await redisService.consumeNonce(orgAlpha, sharedNonce, 180);
    expect(alphaReplay).toBe('REPLAY_DETECTED');

    // Teardown
    await redisService.deleteNonce(orgAlpha, sharedNonce);
    await redisService.deleteNonce(orgBeta, sharedNonce);
  });

  it('should handle concurrent race condition: 10 simultaneous presentations -> exactly 1 ACQUIRED, 9 REPLAY_DETECTED', async () => {
    const raceNonce = crypto.randomBytes(12).toString('hex');

    // Launch 10 simultaneous concurrent consumeNonce calls
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        redisService.consumeNonce(orgAlpha, raceNonce, 180),
      ),
    );

    const acquiredCount = results.filter((r) => r === 'ACQUIRED').length;
    const replayCount = results.filter((r) => r === 'REPLAY_DETECTED').length;

    expect(acquiredCount).toBe(1);
    expect(replayCount).toBe(9);

    // Teardown
    await redisService.deleteNonce(orgAlpha, raceNonce);
  });
});
