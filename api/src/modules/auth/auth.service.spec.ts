import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import { MailService } from '../mail/mail.service.js';
import { AuthService } from './auth.service.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('AuthService', () => {
  let service: AuthService;
  const tx = {
    password_reset_tokens: { updateMany: vi.fn() },
    users: { update: vi.fn() },
    audit_logs: { create: vi.fn() },
  };
  const prisma = {
    users: { findUnique: vi.fn(), update: vi.fn() },
    password_reset_tokens: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const mail = { send: vi.fn() };
  const jwt = new JwtService({ secret: 'segredo-de-teste' });

  beforeEach(async () => {
    vi.resetAllMocks();
    // $transaction aceita uma lista de operações ou um callback com o client da transação
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function' ? arg(tx) : Promise.all(arg as unknown[]),
    );
    mail.send.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: MailService, useValue: mail },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => '3600',
            get: (key: string) =>
              key === 'APP_URL' ? 'http://app.test' : undefined,
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('devolve um token com o id, o e-mail e a versão do token', async () => {
    prisma.users.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@email.com',
      password_hash: await hashPassword('senhaForte123'),
      status: 'active',
      token_version: 3,
    });

    const result = await service.login({
      email: 'Maria@Email.com',
      password: 'senhaForte123',
    });

    expect(prisma.users.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'maria@email.com' } }),
    );
    expect(result.token_type).toBe('Bearer');
    expect(result.expires_in).toBe(3600);
    const payload = await jwt.verifyAsync<{ sub: string; email: string }>(
      result.access_token,
    );
    expect(payload).toMatchObject({
      sub: 'user-1',
      email: 'maria@email.com',
      ver: 3,
    });
  });

  it('recusa senha errada', async () => {
    prisma.users.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@email.com',
      password_hash: await hashPassword('senhaForte123'),
    });

    await expect(
      service.login({ email: 'maria@email.com', password: 'errada123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa e-mail inexistente com a mesma mensagem', async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'ninguem@email.com', password: 'qualquer123' }),
    ).rejects.toThrow('E-mail ou senha inválidos');
  });

  it('recusa conta desativada (com a senha correta)', async () => {
    prisma.users.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@email.com',
      password_hash: await hashPassword('senhaForte123'),
      status: 'deactivated',
      token_version: 0,
    });

    await expect(
      service.login({ email: 'maria@email.com', password: 'senhaForte123' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('logout incrementa a versão dos tokens', async () => {
    await service.logout('user-1');

    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { token_version: { increment: 1 } },
    });
  });

  describe('forgotPassword', () => {
    const maria = {
      id: 'user-1',
      name: 'Maria Silva',
      email: 'maria@email.com',
      status: 'active',
    };

    it('guarda só o hash do token e envia o link com o token original', async () => {
      prisma.users.findUnique.mockResolvedValue(maria);
      prisma.password_reset_tokens.findFirst.mockResolvedValue(null);

      await service.forgotPassword({ email: 'Maria@Email.com' });

      // Links anteriores são invalidados
      expect(prisma.password_reset_tokens.updateMany).toHaveBeenCalledWith({
        where: { user_id: 'user-1', used_at: null },
        data: { used_at: expect.any(Date) as Date },
      });
      const { data } = prisma.password_reset_tokens.create.mock.calls[0][0] as {
        data: { token_hash: string; expires_at: Date };
      };
      const sent = mail.send.mock.calls[0][0] as { to: string; text: string };
      const token = /token=([\w-]+)/.exec(sent.text)![1];

      expect(sent.to).toBe('maria@email.com');
      expect(sent.text).toContain('http://app.test/redefinir-senha?token=');
      expect(data.token_hash).toBe(sha256(token));
      expect(data.token_hash).not.toContain(token);
      // Vale por 30 minutos
      const minutes = (data.expires_at.getTime() - Date.now()) / 60000;
      expect(minutes).toBeGreaterThan(29);
      expect(minutes).toBeLessThanOrEqual(30);
    });

    it('e-mail não cadastrado: não faz nada (e não dá erro)', async () => {
      prisma.users.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'ninguem@email.com' }),
      ).resolves.toBeUndefined();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('conta desativada: não envia', async () => {
      prisma.users.findUnique.mockResolvedValue({
        ...maria,
        status: 'deactivated',
      });

      await service.forgotPassword({ email: 'maria@email.com' });

      expect(mail.send).not.toHaveBeenCalled();
    });

    it('pedido repetido em menos de 1 minuto: não envia de novo', async () => {
      prisma.users.findUnique.mockResolvedValue(maria);
      prisma.password_reset_tokens.findFirst.mockResolvedValue({ id: 'tok-1' });

      await service.forgotPassword({ email: 'maria@email.com' });

      expect(prisma.password_reset_tokens.create).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('escapa o nome no HTML do e-mail', async () => {
      prisma.users.findUnique.mockResolvedValue({
        ...maria,
        name: '<b>Hacker</b> da Silva',
      });
      prisma.password_reset_tokens.findFirst.mockResolvedValue(null);

      await service.forgotPassword({ email: 'maria@email.com' });

      const sent = mail.send.mock.calls[0][0] as { html: string };
      expect(sent.html).toContain('&lt;b&gt;Hacker&lt;/b&gt;');
      expect(sent.html).not.toContain('<b>Hacker');
    });
  });

  describe('resetPassword', () => {
    const valid = {
      id: 'tok-1',
      user_id: 'user-1',
      expires_at: new Date(Date.now() + 60_000),
      used_at: null,
      users: { status: 'active' },
    };

    it('troca a senha, derruba as sessões e registra na auditoria', async () => {
      prisma.password_reset_tokens.findUnique.mockResolvedValue(valid);
      tx.password_reset_tokens.updateMany.mockResolvedValue({ count: 1 });

      await service.resetPassword({
        token: 'abc',
        new_password: 'novaSenha456',
      });

      expect(prisma.password_reset_tokens.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token_hash: sha256('abc') } }),
      );
      const { data } = tx.users.update.mock.calls[0][0] as {
        data: { password_hash: string; token_version: unknown };
      };
      expect(data.token_version).toEqual({ increment: 1 });
      await expect(
        verifyPassword('novaSenha456', data.password_hash),
      ).resolves.toBe(true);
      expect(tx.audit_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'user.password_reset',
        }) as object,
      });
    });

    it.each([
      ['inexistente', null],
      ['já usado', { ...valid, used_at: new Date() }],
      ['expirado', { ...valid, expires_at: new Date(Date.now() - 1000) }],
      ['de conta desativada', { ...valid, users: { status: 'deactivated' } }],
    ])('recusa token %s', async (_, token) => {
      prisma.password_reset_tokens.findUnique.mockResolvedValue(token);

      await expect(
        service.resetPassword({ token: 'abc', new_password: 'novaSenha456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.users.update).not.toHaveBeenCalled();
    });

    it('mesmo link usado duas vezes ao mesmo tempo: só um troca a senha', async () => {
      prisma.password_reset_tokens.findUnique.mockResolvedValue(valid);
      // A outra requisição marcou o token como usado primeiro
      tx.password_reset_tokens.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.resetPassword({ token: 'abc', new_password: 'novaSenha456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.users.update).not.toHaveBeenCalled();
    });
  });
});
