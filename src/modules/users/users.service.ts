import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { hashPassword } from '../../common/utils/password.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

// Campos devolvidos pela API. passwordHash nunca entra aqui.
const userSelect = {
  id: true,
  name: true,
  email: true,
  dateOfBirth: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          dateOfBirth: new Date(dto.dateOfBirth),
          passwordHash: await hashPassword(dto.password),
        },
        select: userSelect,
      });
      return toUser(user);
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toUser);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toUser(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    try {
      // Campos undefined são ignorados pelo Prisma: só o que foi enviado é atualizado
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          name: dto.name,
          email: dto.email?.toLowerCase(),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          passwordHash: dto.password
            ? await hashPassword(dto.password)
            : undefined,
          updatedAt: new Date(),
        },
        select: userSelect,
      });
      return toUser(user);
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}

// DATE do banco vem como Date (meia-noite UTC); a API devolve só 'YYYY-MM-DD'
function toUser(user: SelectedUser): User {
  return { ...user, dateOfBirth: user.dateOfBirth.toISOString().slice(0, 10) };
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
