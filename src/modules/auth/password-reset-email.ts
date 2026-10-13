import type { Mail } from '../mail/mail.service.js';

/** Escapa texto para HTML: o nome vem do cadastro e não pode virar marcação. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** E-mail com o link de redefinição de senha (texto puro + HTML). */
export function passwordResetEmail(
  to: { name: string; email: string },
  link: string,
  minutes: number,
): Mail {
  const firstName = to.name.trim().split(/\s+/)[0];
  const name = escapeHtml(firstName);
  return {
    to: to.email,
    subject: 'Redefinir sua senha da Ecofintech',
    text: [
      `Olá, ${firstName}!`,
      '',
      'Recebemos um pedido para redefinir a senha da sua conta Ecofintech.',
      `Para criar uma nova senha, abra o link abaixo (vale por ${minutes} minutos e só pode ser usado uma vez):`,
      '',
      link,
      '',
      'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
    ].join('\n'),
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0">
          <tr><td style="padding:32px">
            <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#047857">Ecofintech</p>
            <p style="margin:0 0 12px;font-size:16px">Olá, ${name}!</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#334155">
              Recebemos um pedido para redefinir a senha da sua conta. Clique no botão para criar uma nova senha.
            </p>
            <a href="${link}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px">
              Criar nova senha
            </a>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b">
              O link vale por ${minutes} minutos e só pode ser usado uma vez.<br>
              Se não foi você, ignore este e-mail: sua senha continua a mesma.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
