import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { AccountAccessService } from './account-access.service.js';

const PERSONAL = '11111111-1111-4111-8111-111111111111';
const COMPANY_ACCOUNT = '22222222-2222-4222-8222-222222222222';

describe('AccountAccessService', () => {
  let service: AccountAccessService;
  const prisma = { accounts: { findFirst: vi.fn() } };

  const personal = (user_id = 'user-1') => ({
    id: PERSONAL,
    user_id,
    company_id: null,
    companies: null,
  });
  const company = (status: string, members: { role: string }[]) => ({
    id: COMPANY_ACCOUNT,
    user_id: null,
    company_id: 'company-1',
    companies: { status, company_members: members },
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountAccessService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AccountAccessService);
  });

  it('sem header: conta pessoal do usuário', async () => {
    prisma.accounts.findFirst.mockResolvedValue(personal());

    await expect(service.resolve('user-1', undefined)).resolves.toEqual({
      account_id: PERSONAL,
      kind: 'personal',
      company_id: null,
      role: null,
    });
    expect(prisma.accounts.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-1' } }),
    );
  });

  it('header com a própria conta pessoal: mesma conta', async () => {
    prisma.accounts.findFirst.mockResolvedValue(personal());

    await expect(service.resolve('user-1', PERSONAL)).resolves.toMatchObject({
      account_id: PERSONAL,
      kind: 'personal',
    });
    expect(prisma.accounts.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PERSONAL } }),
    );
  });

  it('conta pessoal de outra pessoa: 403', async () => {
    prisma.accounts.findFirst.mockResolvedValue(personal('user-2'));

    await expect(service.resolve('user-1', PERSONAL)).rejects.toThrow(
      new ForbiddenException('Sem acesso a esta conta'),
    );
  });

  it('empresa ativa onde é membro: conta da empresa com o papel', async () => {
    prisma.accounts.findFirst.mockResolvedValue(
      company('active', [{ role: 'member' }]),
    );

    await expect(service.resolve('user-1', COMPANY_ACCOUNT)).resolves.toEqual({
      account_id: COMPANY_ACCOUNT,
      kind: 'company',
      company_id: 'company-1',
      role: 'member',
    });
  });

  it('empresa onde não é (ou deixou de ser) membro: 403', async () => {
    prisma.accounts.findFirst.mockResolvedValue(company('active', []));

    await expect(service.resolve('user-1', COMPANY_ACCOUNT)).rejects.toThrow(
      new ForbiddenException('Sem acesso a esta conta'),
    );
  });

  it('empresa desativada, mesmo sendo membro: 403', async () => {
    prisma.accounts.findFirst.mockResolvedValue(
      company('deactivated', [{ role: 'owner' }]),
    );

    await expect(service.resolve('user-1', COMPANY_ACCOUNT)).rejects.toThrow(
      new ForbiddenException('Sem acesso a esta conta'),
    );
  });

  it('header que não é UUID: 400', async () => {
    await expect(service.resolve('user-1', 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.accounts.findFirst).not.toHaveBeenCalled();
  });

  it('conta inexistente: 403 (não revela se existe)', async () => {
    prisma.accounts.findFirst.mockResolvedValue(null);

    await expect(service.resolve('user-1', COMPANY_ACCOUNT)).rejects.toThrow(
      new ForbiddenException('Sem acesso a esta conta'),
    );
  });
});
