import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AccountsController } from './accounts.controller.js';
import { AccountAccessService } from './account-access.service.js';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountAccessService],
  // Outros módulos usam @ActiveAccount(), que depende do AccountAccessService
  exports: [AccountAccessService],
})
export class AccountsModule {}
