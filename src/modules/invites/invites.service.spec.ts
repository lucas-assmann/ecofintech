import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { InvitesService } from './invites.service.js';

describe('InvitesService', () => {
  let service: InvitesService;
  const tx = {
    company_invites: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    company_members: { create: vi.fn() },
    audit_logs: { create: vi.fn() },
  };
  const prisma = {
    company_invites: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvitesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(InvitesService);
  });

  it('lista só os convites pendentes do usuário, com a empresa e quem convidou', async () => {
    prisma.company_invites.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        created_at: new Date(),
        companies: {
          id: 'company-1',
          trade_name: 'Padaria',
          cnpj: '11222333000181',
        },
        users_company_invites_invited_byTousers: { name: 'Maria' },
      },
    ]);

    const result = await service.listPending('user-2');

    expect(prisma.company_invites.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invited_user_id: 'user-2', status: 'pending' },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'inv-1',
        company: {
          id: 'company-1',
          trade_name: 'Padaria',
          cnpj: '11222333000181',
        },
        invited_by: { name: 'Maria' },
      }),
    ]);
  });

  describe('accept', () => {
    it('convite de outra pessoa ou que não está pendente: 404', async () => {
      tx.company_invites.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.accept('user-2', 'inv-1')).rejects.toThrow(
        new NotFoundException('Convite não encontrado'),
      );
      expect(tx.company_members.create).not.toHaveBeenCalled();
    });

    it('vira membro, marca como aceito e registra na auditoria, tudo junto', async () => {
      tx.company_invites.updateMany.mockResolvedValue({ count: 1 });
      tx.company_invites.findUniqueOrThrow.mockResolvedValue({
        company_id: 'company-1',
      });

      await service.accept('user-2', 'inv-1');

      expect(tx.company_invites.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', invited_user_id: 'user-2', status: 'pending' },
        data: { status: 'accepted', responded_at: expect.any(Date) as Date },
      });
      expect(tx.company_members.create).toHaveBeenCalledWith({
        data: { company_id: 'company-1', user_id: 'user-2', role: 'member' },
      });
      expect(tx.audit_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor_id: 'user-2',
          action: 'company.member_join',
          target_id: 'company-1',
        }) as object,
      });
    });
  });

  describe('decline', () => {
    it('convite que não é dele: 404', async () => {
      tx.company_invites.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.decline('user-2', 'inv-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('marca como recusado', async () => {
      tx.company_invites.updateMany.mockResolvedValue({ count: 1 });

      await service.decline('user-2', 'inv-1');

      expect(tx.company_invites.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', invited_user_id: 'user-2', status: 'pending' },
        data: { status: 'declined', responded_at: expect.any(Date) as Date },
      });
      expect(tx.company_members.create).not.toHaveBeenCalled();
    });
  });
});
