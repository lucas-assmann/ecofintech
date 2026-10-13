import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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

@Module({
  imports: [
    // validate: a API não sobe se o .env estiver incompleto ou inválido
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    UsersModule,
    AccountsModule,
    TransactionsModule,
    AuthModule,
    DeactivationRequestsModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Os guards rodam nesta ordem: primeiro o token, depois o perfil
    // Protege todas as rotas por padrão; libere com @Public()
    { provide: APP_GUARD, useClass: AuthGuard },
    // Restringe por perfil as rotas marcadas com @Roles(...)
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
