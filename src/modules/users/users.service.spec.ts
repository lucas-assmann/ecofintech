import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { verifyPassword } from '../../common/utils/password.js';
import { UsersService } from './users.service.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });

const dbUser = {
  id: '1',
  name: 'Maria Silva',
  email: 'maria@email.com',
  dateOfBirth: new Date('1995-08-20'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    const dto = {
      name: 'Maria Silva',
      email: 'Maria@Email.com',
      dateOfBirth: '1995-08-20',
      password: 'senhaForte123',
    };

    it('salva o hash da senha (não a senha) e o e-mail em minúsculas', async () => {
      prisma.user.create.mockResolvedValue(dbUser);

      const user = await service.create(dto);

      const { data } = prisma.user.create.mock.calls[0][0] as {
        data: { email: string; passwordHash: string };
      };
      expect(data.email).toBe('maria@email.com');
      expect(data.passwordHash).not.toBe(dto.password);
      expect(await verifyPassword(dto.password, data.passwordHash)).toBe(true);
      expect(user.dateOfBirth).toBe('1995-08-20');
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('lança Conflict quando o e-mail já existe', async () => {
      prisma.user.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('findOne lança NotFound quando o usuário não existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne('id-inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update lança NotFound quando o usuário não existe', async () => {
    prisma.user.update.mockRejectedValue(prismaError('P2025'));

    await expect(
      service.update('1', { name: 'Novo Nome' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove lança NotFound quando o usuário não existe', async () => {
    prisma.user.delete.mockRejectedValue(prismaError('P2025'));

    await expect(service.remove('1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
