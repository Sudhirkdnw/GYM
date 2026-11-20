import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('redis.host', '127.0.0.1');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 100, 2000);
      },
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis background error: ${err.message}`);
    });

    try {
      await this.client.connect();
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    } catch (err) {
      this.logger.warn(`Initial Redis connection failed: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.client = null;
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('REDIS_UNAVAILABLE: Redis client is not initialized');
    }
    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client) return false;
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Atomically consumes a nonce for dynamic QR replay prevention.
   * Command: SET attendance:nonce:<orgId>:<nonce> 1 EX <ttlSeconds> NX
   *
   * @param orgId - Organization UUID
   * @param nonce - Cryptographic nonce string
   * @param ttlSeconds - Time-to-live in seconds (default 180s = 2x token life)
   * @returns 'ACQUIRED' if first presentation, 'REPLAY_DETECTED' if already consumed
   * @throws Error if Redis is offline or operation times out (Fail-Closed)
   */
  async consumeNonce(
    orgId: string,
    nonce: string,
    ttlSeconds = 180,
  ): Promise<'ACQUIRED' | 'REPLAY_DETECTED'> {
    if (!this.client) {
      throw new Error('REDIS_UNAVAILABLE: Redis client is not initialized');
    }

    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      const key = `attendance:nonce:${orgId}:${nonce}`;
      const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK' ? 'ACQUIRED' : 'REPLAY_DETECTED';
    } catch (error) {
      this.logger.error(
        `Failed to execute atomic nonce consumption check: ${(error as Error).message}`,
      );
      throw new Error(`REDIS_REPLAY_CHECK_FAILED: ${(error as Error).message}`);
    }
  }

  /**
   * Clears a nonce (primarily used for test teardown).
   */
  async deleteNonce(orgId: string, nonce: string): Promise<void> {
    if (this.client) {
      await this.client.del(`attendance:nonce:${orgId}:${nonce}`).catch(() => {});
    }
  }
}
