import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import {
  DeactivationRequestsService,
  REQUEST_RECEIVED_MESSAGE,
} from './deactivation-requests.service.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });

const selected = (status = 'pending') => ({
  id: 'req-1',
  status,
  reason: null,
  requested_at: new Date(),
  reviewed_at: null,
  review_note: null,
  users_deactivation_requests_user_idTousers: {
    id: 'user-1',
    name: 'Maria',
    email: 'maria@email.com',
  },
});

describe('DeactivationRequestsService', () => {
  let service: DeactivationRequestsService;
  const tx = {
    deactivation_requests: { findUnique: vi.fn(), update: vi.fn() },
    accounts: { findUnique: vi.fn() },
    users: { update: vi.fn() },
  };
  const prisma = {
    deactivation_requests: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeactivationRequestsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DeactivationRequestsService>(
      DeactivationRequestsService,
    );
  });

  describe('create', () => {
    it('cria a solicitação e devolve a mensagem do suporte', async () => {
      prisma.deactivation_requests.create.mockResolvedValue(selected());

      const result = await service.create('user-1', { reason: 'Motivo' });

      expect(result.message).toBe(REQUEST_RECEIVED_MESSAGE);
      expect(result.request).toMatchObject({
        status: 'pending',
        user: { id: 'user-1' },
      });
    });

    it('lança Conflict quando já existe uma pendente', async () => {
      prisma.deactivation_requests.create.mockRejectedValue(
        prismaError('P2002'),
      );

      await expect(service.create('user-1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('approve', () => {
    it('desativa o usuário, derruba as sessões e registra quem aprovou', async () => {
      tx.deactivation_requests.findUnique.mockResolvedValue({
        user_id: 'user-1',
        status: 'pending',
      });
      tx.accounts.findUnique.mockResolvedValue({
        balance: new Prisma.Decimal('0'),
      });
      tx.deactivation_requests.update.mockResolvedValue(selected('approved'));

      const result = await service.approve('admin-1', 'req-1', {});

      expect(tx.users.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            status: 'deactivated',
            token_version: { increment: 1 },
          }) as unknown,
        }),
      );
      expect(tx.deactivation_requests.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'approved',
            reviewed_by: 'admin-1',
          }) as unknown,
        }),
      );
      expect(result.status).toBe('approved');
    });

    it('não aprova enquanto a conta tiver saldo', async () => {
      tx.deactivation_requests.findUnique.mockResolvedValue({
        user_id: 'user-1',
        status: 'pending',
      });
      tx.accounts.findUnique.mockResolvedValue({
        balance: new Prisma.Decimal('150'),
      });

      await expect(service.approve('admin-1', 'req-1', {})).rejects.toThrow(
        'A conta ainda tem saldo de R$ 150.00',
      );
      expect(tx.users.update).not.toHaveBeenCalled();
    });

    it('não reavalia uma solicitação já avaliada', async () => {
      tx.deactivation_requests.findUnique.mockResolvedValue({
        user_id: 'user-1',
        status: 'rejected',
      });

      await expect(
        service.approve('admin-1', 'req-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lança NotFound para solicitação inexistente', async () => {
      tx.deactivation_requests.findUnique.mockResolvedValue(null);

      await expect(
        service.approve('admin-1', 'req-x', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('reject marca como recusada sem desativar o usuário', async () => {
    tx.deactivation_requests.findUnique.mockResolvedValue({
      user_id: 'user-1',
      status: 'pending',
    });
    tx.deactivation_requests.update.mockResolvedValue(selected('rejected'));

    const result = await service.reject('admin-1', 'req-1', { note: 'Não' });

    expect(result.status).toBe('rejected');
    expect(tx.users.update).not.toHaveBeenCalled();
  });
});
