import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import { User } from './entities/user.entity.js';

// Campos devolvidos pela API. password_hash nunca entra aqui.
const userSelect = {
  id: true,
  name: true,
  email: true,
  date_of_birth: true,
  role: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.usersSelect;

type SelectedUser = Prisma.usersGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<User> {
    try {
      const user = await this.prisma.users.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          date_of_birth: new Date(dto.date_of_birth),
          password_hash: await hashPassword(dto.password),
        },
        select: userSelect,
      });
      return toUser(user);
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.users.findMany({
      select: userSelect,
      orderBy: { created_at: 'desc' },
    });
    return users.map(toUser);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toUser(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    try {
      // Campos undefined são ignorados pelo Prisma: só o que foi enviado é atualizado
      const user = await this.prisma.users.update({
        where: { id },
        data: {
          name: dto.name,
          email: dto.email?.toLowerCase(),
          date_of_birth: dto.date_of_birth
            ? new Date(dto.date_of_birth)
            : undefined,
          updated_at: new Date(),
        },
        select: userSelect,
      });
      return toUser(user);
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async updatePassword(id: string, dto: UpdatePasswordDto): Promise<void> {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: { password_hash: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const valid = await verifyPassword(
      dto.current_password,
      user.password_hash,
    );
    if (!valid) throw new BadRequestException('Senha atual incorreta');

    await this.prisma.users.update({
      where: { id },
      data: {
        password_hash: await hashPassword(dto.new_password),
        updated_at: new Date(),
      },
    });
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.users.delete({ where: { id } });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}

// DATE do banco vem como Date (meia-noite UTC); a API devolve só 'YYYY-MM-DD'
function toUser(user: SelectedUser): User {
  return {
    ...user,
    date_of_birth: user.date_of_birth.toISOString().slice(0, 10),
  };
}

function handlePrismaError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new ConflictException('E-mail já cadastrado');
    }
    if (error.code === 'P2025') {
      return new NotFoundException('Usuário não encontrado');
    }
  }
  return error;
}
