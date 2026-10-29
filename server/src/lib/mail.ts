import { config } from '../config.js';

export type Mail = { to: string; subject: string; text: string; html: string };

/** Ohne Mail-Dienst (lokal, Tests) landen Mails hier statt im Postfach. */
export const outbox: Mail[] = [];

export const mailConfigured = Boolean(config.mail.resendKey);

export async function sendMail(mail: Mail): Promise<void> {
  if (!config.mail.resendKey) {
    if (config.production) {
      console.error(`E-Mail an ${mail.to} nicht gesendet: RESEND_API_KEY fehlt`);
      return;
    }
    outbox.push(mail);
    if (outbox.length > 50) outbox.shift();
    console.info(`[mail] an ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.mail.resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: config.mail.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Mailversand fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function resetMail(name: string, link: string): Omit<Mail, 'to'> {
  const text = [
    `Hallo ${name},`,
    '',
    'jemand – hoffentlich du – möchte das Passwort für dein Lapis-Konto zurücksetzen.',
    'Über diesen Link kannst du ein neues festlegen. Er gilt eine Stunde und nur einmal:',
    '',
    link,
    '',
    'Wenn du das nicht warst, kannst du diese Mail einfach ignorieren. Dein Passwort bleibt dann, wie es ist.',
    '',
    '– Lapis',
  ].join('\n');
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#F7F4F0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0B1433">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:17px;font-weight:650;margin:0 0 28px">◆ Lapis</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px">Hallo ${escape(name)},</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px">jemand – hoffentlich du – möchte das Passwort für dein Lapis-Konto zurücksetzen. Der Link gilt eine Stunde und nur einmal.</p>
    <p style="margin:0 0 28px"><a href="${escape(link)}" style="display:inline-block;background:#213885;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:11px">Neues Passwort festlegen</a></p>
    <p style="font-size:13px;line-height:1.6;color:#4A4F66;margin:0 0 8px">Oder kopiere diesen Link in deinen Browser:<br><span style="word-break:break-all">${escape(link)}</span></p>
    <p style="font-size:13px;line-height:1.6;color:#868896;margin:24px 0 0">Wenn du das nicht warst, ignoriere diese Mail einfach. Dein Passwort bleibt dann, wie es ist.</p>
  </div></body></html>`;
  return { subject: 'Dein neues Passwort für Lapis', text, html };
}
