import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';

@Injectable()
export class AuthService {
  private readonly expiresIn: number;

  // Usado quando o e-mail não existe: a verificação roda do mesmo jeito, para
  // que o tempo de resposta não revele quais e-mails estão cadastrados
  private readonly dummyHash = hashPassword('senha-inexistente');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.expiresIn = Number(config.getOrThrow<string>('JWT_EXPIRES_IN'));
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true, email: true, password_hash: true },
    });

    const valid = await verifyPassword(
      dto.password,
      user?.password_hash ?? (await this.dummyHash),
    );
    // Mesma mensagem para e-mail inexistente e senha errada
    if (!user || !valid) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      access_token: await this.jwt.signAsync(payload),
      token_type: 'Bearer',
      expires_in: this.expiresIn,
    };
  }
}
