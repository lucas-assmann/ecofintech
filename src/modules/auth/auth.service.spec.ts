import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service.js';
import { hashPassword } from '../../common/utils/password.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = { users: { findUnique: vi.fn() } };
  const jwt = new JwtService({ secret: 'segredo-de-teste' });

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { getOrThrow: () => '3600' } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('devolve um token com o id e o e-mail do usuário', async () => {
    prisma.users.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'maria@email.com',
      password_hash: await hashPassword('senhaForte123'),
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
    expect(payload).toMatchObject({ sub: 'user-1', email: 'maria@email.com' });
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
});
