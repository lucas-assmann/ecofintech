import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { verifyPassword } from '../../common/utils/password.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const db = { query: vi.fn() };

  beforeEach(async () => {
    db.query.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: DatabaseService, useValue: db }],
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
      db.query.mockResolvedValue([{ id: '1' }]);

      await service.create(dto);

      const [sql, params] = db.query.mock.calls[0] as [string, string[]];
      expect(sql).toContain('INSERT INTO users');
      expect(params[1]).toBe('maria@email.com');
      expect(params[3]).not.toBe(dto.password);
      expect(await verifyPassword(dto.password, params[3])).toBe(true);
    });

    it('lança Conflict quando o e-mail já existe', async () => {
      db.query.mockRejectedValue({ code: '23505' });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('findOne lança NotFound quando o usuário não existe', async () => {
    db.query.mockResolvedValue([]);

    await expect(service.findOne('id-inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update monta o SET só com os campos enviados', async () => {
    db.query.mockResolvedValue([{ id: '1' }]);

    await service.update('1', { name: 'Novo Nome' });

    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('SET name = $1, updated_at = now()');
    expect(sql).toContain('WHERE id = $2');
    expect(params).toEqual(['Novo Nome', '1']);
  });

  it('remove lança NotFound quando nada foi apagado', async () => {
    db.query.mockResolvedValue([]);

    await expect(service.remove('1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
