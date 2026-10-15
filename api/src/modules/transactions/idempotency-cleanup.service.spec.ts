import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service.js';
import {
  IdempotencyCleanupService,
  IDEMPOTENCY_KEY_TTL_HOURS,
} from './idempotency-cleanup.service.js';

describe('IdempotencyCleanupService', () => {
  let service: IdempotencyCleanupService;
  const prisma = { idempotency_keys: { deleteMany: vi.fn() } };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyCleanupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(IdempotencyCleanupService);
  });

  afterEach(() => vi.useRealTimers());

  it('apaga só as chaves criadas antes do prazo de validade', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
    prisma.idempotency_keys.deleteMany.mockResolvedValue({ count: 3 });

    const removed = await service.purgeExpired();

    expect(removed).toBe(3);
    expect(IDEMPOTENCY_KEY_TTL_HOURS).toBe(24);
    expect(prisma.idempotency_keys.deleteMany).toHaveBeenCalledWith({
      where: { created_at: { lt: new Date('2026-10-13T12:00:00Z') } },
    });
  });

  it('roda a limpeza quando a API liga', async () => {
    prisma.idempotency_keys.deleteMany.mockResolvedValue({ count: 0 });

    await service.onApplicationBootstrap();

    expect(prisma.idempotency_keys.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('não derruba a API se a limpeza falhar', async () => {
    prisma.idempotency_keys.deleteMany.mockRejectedValue(
      new Error('banco fora'),
    );

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    await expect(service.handleCron()).resolves.toBeUndefined();
  });
});
