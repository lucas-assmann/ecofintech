import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

@Module({
  providers: [MailService],
  // Exportado para outros módulos (ex.: Auth) poderem enviar e-mails
  exports: [MailService],
})
export class MailModule {}
