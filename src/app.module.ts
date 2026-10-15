import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DeactivationRequestsModule } from './modules/deactivation-requests/deactivation-requests.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { InvitesModule } from './modules/invites/invites.module.js';

@Module({
  imports: [
    // validate: a API não sobe se o .env estiver incompleto ou inválido
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Limite geral por IP: 100 requisições por minuto (rotas sensíveis usam
    // @AuthThrottle(), mais rígido). Contagem em memória, por instância da API.
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 100, ttl: minutes(1) }],
      errorMessage: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
    }),
    // Tarefas agendadas (@Cron), ex.: limpeza das chaves de idempotência
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    AccountsModule,
    TransactionsModule,
    AuthModule,
    DeactivationRequestsModule,
    MailModule,
    CompaniesModule,
    InvitesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Os guards rodam nesta ordem: limite de requisições, token, perfil
    // Recusa com 429 quem passou do limite, antes de qualquer outra checagem
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Protege todas as rotas por padrão; libere com @Public()
    { provide: APP_GUARD, useClass: AuthGuard },
    // Restringe por perfil as rotas marcadas com @Roles(...)
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
