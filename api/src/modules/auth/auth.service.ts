import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import { MailService } from '../mail/mail.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { passwordResetEmail } from './password-reset-email.js';

/** Quanto tempo o link de redefinição vale */
const RESET_TTL_MINUTES = 30;
/** Intervalo mínimo entre dois e-mails de redefinição para o mesmo usuário */
const RESET_RESEND_SECONDS = 60;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly expiresIn: number;
  private readonly appUrl: string;

  // Usado quando o e-mail não existe: a verificação roda do mesmo jeito, para
  // que o tempo de resposta não revele quais e-mails estão cadastrados
  private readonly dummyHash = hashPassword('senha-inexistente');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.expiresIn = Number(config.getOrThrow<string>('JWT_EXPIRES_IN'));
    this.appUrl = config.get<string>('APP_URL') ?? 'http://localhost:5173';
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password_hash: true,
        status: true,
        token_version: true,
      },
    });

    const valid = await verifyPassword(
      dto.password,
      user?.password_hash ?? (await this.dummyHash),
    );
    // Mesma mensagem para e-mail inexistente e senha errada
    if (!user || !valid) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    // Só informa a desativação depois de confirmar a senha
    if (user.status !== 'active') {
      throw new ForbiddenException('Conta desativada');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      ver: user.token_version,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      token_type: 'Bearer',
      expires_in: this.expiresIn,
    };
  }

  /** Encerra a sessão: invalida todos os tokens do usuário. */
  async logout(user_id: string): Promise<void> {
    await this.prisma.users.update({
      where: { id: user_id },
      data: { token_version: { increment: 1 } },
    });
  }

  /**
   * "Esqueci minha senha": cria um link de uso único e envia por e-mail.
   * Não informa se o e-mail existe (a resposta da rota é sempre a mesma),
   * para ninguém usar esta rota para descobrir quem tem conta.
   */
  async forgotPassword({ email }: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!user || user.status !== 'active') return;

    // No máximo um e-mail por minuto: evita lotar a caixa de alguém
    const recent = await this.prisma.password_reset_tokens.findFirst({
      where: {
        user_id: user.id,
        created_at: { gt: new Date(Date.now() - RESET_RESEND_SECONDS * 1000) },
      },
      select: { id: true },
    });
    if (recent) return;

    // 32 bytes aleatórios: impossível de adivinhar. Vai no link; no banco, só o hash.
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      // Um link novo invalida os anteriores que ainda não foram usados
      this.prisma.password_reset_tokens.updateMany({
        where: { user_id: user.id, used_at: null },
        data: { used_at: new Date() },
      }),
      this.prisma.password_reset_tokens.create({
        data: {
          user_id: user.id,
          token_hash: sha256(token),
          expires_at: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
        },
      }),
    ]);

    const link = `${this.appUrl}/redefinir-senha?token=${token}`;
    // Sem await: o envio demora, e esperar por ele deixaria a resposta mais
    // lenta só quando o e-mail existe (o tempo revelaria quem tem conta)
    this.mail
      .send(passwordResetEmail(user, link, RESET_TTL_MINUTES))
      .catch((error: unknown) =>
        this.logger.error('Falha ao enviar e-mail de redefinição', error),
      );
  }

  /** Troca a senha usando o token do link. Encerra todas as sessões abertas. */
  async resetPassword({
    token,
    new_password,
  }: ResetPasswordDto): Promise<void> {
    const invalid = () =>
      new BadRequestException('Este link é inválido, expirou ou já foi usado.');
    const found = await this.prisma.password_reset_tokens.findUnique({
      where: { token_hash: sha256(token) },
      select: {
        id: true,
        user_id: true,
        expires_at: true,
        used_at: true,
        users: { select: { status: true } },
      },
    });
    if (
      !found ||
      found.used_at ||
      found.expires_at < new Date() ||
      found.users.status !== 'active'
    ) {
      throw invalid();
    }

    const password_hash = await hashPassword(new_password);
    await this.prisma.$transaction(async (tx) => {
      // Marca como usado só se ainda não foi: se o mesmo link for enviado duas
      // vezes ao mesmo tempo, só uma das requisições troca a senha
      const { count } = await tx.password_reset_tokens.updateMany({
        where: { id: found.id, used_at: null },
        data: { used_at: new Date() },
      });
      if (count === 0) throw invalid();

      await tx.users.update({
        where: { id: found.user_id },
        data: {
          password_hash,
          // Derruba as sessões abertas (inclusive a de quem pediu, se não foi o dono)
          token_version: { increment: 1 },
          updated_at: new Date(),
        },
      });
      await tx.audit_logs.create({
        data: {
          actor_id: found.user_id,
          action: 'user.password_reset',
          target_type: 'user',
          target_id: found.user_id,
        },
      });
    });
  }
}
