import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  /** Versão em texto puro (clientes de e-mail sem HTML e filtros de spam) */
  text: string;
  html: string;
}

/**
 * Envia e-mails por SMTP. Em desenvolvimento o SMTP é o Mailpit
 * (caixa de entrada em http://localhost:8025); em produção, qualquer
 * provedor SMTP (Gmail, Resend, SES...) só trocando o .env.
 * Sem SMTP_HOST configurado, não envia: escreve o e-mail no terminal.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    this.from =
      config.get<string>('MAIL_FROM') ??
      'Ecofintech <nao-responda@ecofintech.local>';
    const port = Number(config.get<string>('SMTP_PORT') ?? 587);
    this.transporter = host
      ? createTransport({
          host,
          port,
          // 465 e 2465 (alternativa do Resend, já que o Render bloqueia as
          // portas SMTP padrão) usam TLS direto; as outras sobem para TLS
          // se o servidor oferecer
          secure: port === 465 || port === 2465,
          auth: user
            ? { user, pass: config.get<string>('SMTP_PASS') }
            : undefined,
        })
      : null;
  }

  async send(mail: Mail): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP não configurado; e-mail não enviado.\nPara: ${mail.to}\nAssunto: ${mail.subject}\n\n${mail.text}`,
      );
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...mail });
  }
}
