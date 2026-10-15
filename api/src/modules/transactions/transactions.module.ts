import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionsController } from './transactions.controller.js';
import { IdempotencyCleanupService } from './idempotency-cleanup.service.js';

@Module({
  // @ActiveAccount() usa o AccountAccessService exportado pelo AccountsModule
  imports: [AccountsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, IdempotencyCleanupService],
})
export class TransactionsModule {}
