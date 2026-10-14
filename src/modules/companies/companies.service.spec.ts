import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { CompaniesService } from './companies.service.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });

describe('CompaniesService', () => {
  let service: CompaniesService;
  const tx = {
    companies: { create: vi.fn() },
    audit_logs: { create: vi.fn() },
    company_invites: { create: vi.fn(), updateMany: vi.fn() },
    company_members: { deleteMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(),
    company_members: { findUnique: vi.fn(), findMany: vi.fn() },
    company_invites: { findMany: vi.fn() },
    users: { findFirst: vi.fn() },
  };

  /** Papel de alguém na empresa, na ordem das consultas (null = não é membro) */
  const role = (value: string | null) =>
    prisma.company_members.findUnique.mockResolvedValueOnce(
      value ? { role: value } : null,
    );

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CompaniesService);
  });

  describe('create', () => {
    const dto = {
      cnpj: '11222333000181',
      legal_name: 'Pão Bom Comércio de Alimentos LTDA',
      trade_name: 'Padaria Pão Bom',
    };

    it('cria a empresa com o usuário como dono e a conta, e registra na auditoria', async () => {
      tx.companies.create.mockResolvedValue({
        id: 'company-1',
        cnpj: dto.cnpj,
        trade_name: dto.trade_name,
        accounts: { id: 'acc-c', balance: new Prisma.Decimal('0') },
      });

      const result = await service.create('user-1', dto);

      const { data } = tx.companies.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toMatchObject({
        ...dto,
        created_by: 'user-1',
        company_members: { create: { user_id: 'user-1', role: 'owner' } },
        accounts: { create: {} },
      });
      expect(tx.audit_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor_id: 'user-1',
          action: 'company.create',
          target_type: 'company',
          target_id: 'company-1',
        }) as object,
      });
      expect(result).toEqual({
        id: 'acc-c',
        kind: 'company',
        name: 'Padaria Pão Bom',
        document: '11222333000181',
        balance: '0.00',
        role: 'owner',
        company_id: 'company-1',
      });
    });

    it('CNPJ já cadastrado: 409', async () => {
      tx.companies.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.create('user-1', dto)).rejects.toThrow(
        new ConflictException('Este CNPJ já está cadastrado'),
      );
    });
  });

  describe('listMembers', () => {
    const members = [
      {
        user_id: 'user-1',
        role: 'owner',
        created_at: new Date(),
        users: { name: 'Maria', email: 'maria@email.com' },
      },
    ];

    it('quem não é membro: 403', async () => {
      role(null);

      await expect(
        service.listMembers('user-x', 'company-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('membro vê os membros, mas não os convites', async () => {
      role('member');
      prisma.company_members.findMany.mockResolvedValue(members);

      const result = await service.listMembers('user-2', 'company-1');

      expect(result.members).toEqual([
        expect.objectContaining({
          user_id: 'user-1',
          name: 'Maria',
          role: 'owner',
        }),
      ]);
      expect(result.invites).toEqual([]);
      expect(prisma.company_invites.findMany).not.toHaveBeenCalled();
    });

    it('dono vê também os convites pendentes', async () => {
      role('owner');
      prisma.company_members.findMany.mockResolvedValue(members);
      prisma.company_invites.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          created_at: new Date(),
          users_company_invites_invited_user_idTousers: {
            name: 'João',
            email: 'joao@email.com',
          },
        },
      ]);

      const result = await service.listMembers('user-1', 'company-1');

      expect(prisma.company_invites.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { company_id: 'company-1', status: 'pending' },
        }),
      );
      expect(result.invites).toEqual([
        expect.objectContaining({
          id: 'inv-1',
          invited_user: { name: 'João', email: 'joao@email.com' },
        }),
      ]);
    });
  });

  describe('invite', () => {
    const joao = { id: 'user-2', status: 'active' };

    it('quem não é dono: 403', async () => {
      role('member');

      await expect(
        service.invite('user-2', 'company-1', { email: 'x@email.com' }),
      ).rejects.toThrow(
        new ForbiddenException('Só o dono da empresa pode fazer isso'),
      );
    });

    it('sem e-mail nem CPF, ou com os dois: 400', async () => {
      role('owner');
      await expect(
        service.invite('user-1', 'company-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      role('owner');
      await expect(
        service.invite('user-1', 'company-1', {
          email: 'a@a.com',
          cpf: '52998224725',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('usuário inexistente: 404', async () => {
      role('owner');
      prisma.users.findFirst.mockResolvedValue(null);

      await expect(
        service.invite('user-1', 'company-1', { email: 'ninguem@email.com' }),
      ).rejects.toThrow(new NotFoundException('Usuário não encontrado'));
    });

    it('convidar a si mesmo: 422', async () => {
      role('owner');
      prisma.users.findFirst.mockResolvedValue({
        id: 'user-1',
        status: 'active',
      });

      await expect(
        service.invite('user-1', 'company-1', { email: 'maria@email.com' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('usuário desativado: 422, sem criar convite', async () => {
      role('owner');
      prisma.users.findFirst.mockResolvedValue({
        id: 'user-2',
        status: 'deactivated',
      });

      await expect(
        service.invite('user-1', 'company-1', { cpf: '52998224725' }),
      ).rejects.toThrow(new UnprocessableEntityException('Usuário desativado'));
      expect(tx.company_invites.create).not.toHaveBeenCalled();
    });

    it('quem já é membro: 409', async () => {
      role('owner');
      prisma.users.findFirst.mockResolvedValue(joao);
      role('member'); // o convidado já participa

      await expect(
        service.invite('user-1', 'company-1', { email: 'joao@email.com' }),
      ).rejects.toThrow(
        new ConflictException('Esta pessoa já faz parte da empresa'),
      );
    });

    it('convite pendente já existe (índice único): 409', async () => {
      role('owner');
      prisma.users.findFirst.mockResolvedValue(joao);
      role(null);
      tx.company_invites.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.invite('user-1', 'company-1', { email: 'joao@email.com' }),
      ).rejects.toThrow(
        new ConflictException('Esta pessoa já tem um convite pendente'),
      );
    });

    it('cria o convite pelo CPF e registra na auditoria', async () => {
      role('owner');
      prisma.users.findFirst.mockResolvedValue(joao);
      role(null);
      tx.company_invites.create.mockResolvedValue({ id: 'inv-1' });

      await service.invite('user-1', 'company-1', { cpf: '52998224725' });

      expect(prisma.users.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cpf: '52998224725' } }),
      );
      expect(tx.company_invites.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            company_id: 'company-1',
            invited_user_id: 'user-2',
            invited_by: 'user-1',
          },
        }),
      );
      expect(tx.audit_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'company.invite' }) as object,
      });
    });
  });

  describe('cancelInvite', () => {
    it('convite que não está pendente: 404', async () => {
      role('owner');
      tx.company_invites.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.cancelInvite('user-1', 'company-1', 'inv-1'),
      ).rejects.toThrow(new NotFoundException('Convite não encontrado'));
    });

    it('cancela e registra na auditoria', async () => {
      role('owner');
      tx.company_invites.updateMany.mockResolvedValue({ count: 1 });

      await service.cancelInvite('user-1', 'company-1', 'inv-1');

      expect(tx.company_invites.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', company_id: 'company-1', status: 'pending' },
        data: { status: 'canceled', responded_at: expect.any(Date) as Date },
      });
      expect(tx.audit_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'company.invite_cancel',
        }) as object,
      });
    });
  });

  describe('removeMember', () => {
    it('dono removendo a si mesmo: 422', async () => {
      role('owner');

      await expect(
        service.removeMember('user-1', 'company-1', 'user-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(tx.company_members.deleteMany).not.toHaveBeenCalled();
    });

    it('membro inexistente: 404', async () => {
      role('owner');
      tx.company_members.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.removeMember('user-1', 'company-1', 'user-9'),
      ).rejects.toThrow(new NotFoundException('Membro não encontrado'));
    });

    it('remove e registra na auditoria', async () => {
      role('owner');
      tx.company_members.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeMember('user-1', 'company-1', 'user-2');

      expect(tx.company_members.deleteMany).toHaveBeenCalledWith({
        where: { company_id: 'company-1', user_id: 'user-2' },
      });
      expect(tx.audit_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'company.member_remove',
        }) as object,
      });
    });
  });

  describe('leave', () => {
    it('o dono não pode sair: 422', async () => {
      role('owner');

      await expect(service.leave('user-1', 'company-1')).rejects.toThrow(
        new UnprocessableEntityException('O dono não pode sair da empresa'),
      );
    });

    it('quem não é membro: 403', async () => {
      role(null);

      await expect(service.leave('user-x', 'company-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('membro sai e fica registrado na auditoria', async () => {
      role('member');
      tx.company_members.deleteMany.mockResolvedValue({ count: 1 });

      await service.leave('user-2', 'company-1');

      expect(tx.company_members.deleteMany).toHaveBeenCalledWith({
        where: { company_id: 'company-1', user_id: 'user-2' },
      });
      expect(tx.audit_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'company.member_leave',
        }) as object,
      });
    });
  });
});
