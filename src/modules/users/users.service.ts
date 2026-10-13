import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { hashPassword } from '../../common/utils/password.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

// Colunas devolvidas pela API. password_hash nunca entra aqui.
// "AS" renomeia snake_case (padrão no SQL) para camelCase (padrão no TS).
const USER_COLUMNS = `
  id,
  name,
  email,
  date_of_birth AS "dateOfBirth",
  created_at    AS "createdAt",
  updated_at    AS "updatedAt"
`;

// Código de erro do PostgreSQL para violação de UNIQUE
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateUserDto): Promise<User> {
    const passwordHash = await hashPassword(dto.password);
    try {
      // RETURNING devolve a linha inserida, sem precisar de um SELECT depois
      const [user] = await this.db.query<User>(
        `INSERT INTO users (name, email, date_of_birth, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING ${USER_COLUMNS}`,
        [dto.name, dto.email.toLowerCase(), dto.dateOfBirth, passwordHash],
      );
      return user;
    } catch (error) {
      throw this.handleUniqueEmail(error);
    }
  }

  findAll(): Promise<User[]> {
    return this.db.query<User>(
      `SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC`,
    );
  }

  async findOne(id: string): Promise<User> {
    const [user] = await this.db.query<User>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    // Monta o SET só com os campos enviados. Os nomes de coluna vêm desta lista
    // fixa (nunca do usuário) e os valores vão como parâmetros $n.
    const fields: [column: string, value: unknown][] = [];
    if (dto.name !== undefined) fields.push(['name', dto.name]);
    if (dto.email !== undefined)
      fields.push(['email', dto.email.toLowerCase()]);
    if (dto.dateOfBirth !== undefined)
      fields.push(['date_of_birth', dto.dateOfBirth]);
    if (dto.password !== undefined)
      fields.push(['password_hash', await hashPassword(dto.password)]);

    if (fields.length === 0) return this.findOne(id);

    const setClause = fields
      .map(([column], index) => `${column} = $${index + 1}`)
      .join(', ');
    const values = fields.map(([, value]) => value);

    try {
      const [user] = await this.db.query<User>(
        `UPDATE users
         SET ${setClause}, updated_at = now()
         WHERE id = $${values.length + 1}
         RETURNING ${USER_COLUMNS}`,
        [...values, id],
      );
      if (!user) throw new NotFoundException('Usuário não encontrado');
      return user;
    } catch (error) {
      throw this.handleUniqueEmail(error);
    }
  }

  async remove(id: string): Promise<void> {
    const rows = await this.db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id],
    );
    if (rows.length === 0)
      throw new NotFoundException('Usuário não encontrado');
  }

  private handleUniqueEmail(error: unknown): unknown {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return new ConflictException('E-mail já cadastrado');
    }
    return error;
  }
}
