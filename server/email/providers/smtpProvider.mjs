import nodemailer from 'nodemailer';

import { renderEmailTemplate } from '../renderEmailTemplate.mjs';

export function createSmtpProvider(config) {
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort),
    secure: false,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  return {
    async sendEmail({ to, subject, message, businessName, logoUrl, fromEmailOverride, fromNameOverride }) {
      const html = renderEmailTemplate({
        businessName,
        logoUrl,
        subject,
        message,
      });

      const effectiveFromEmail = fromEmailOverride || config.fromEmail;
      const effectiveFromName = fromNameOverride || config.fromName;

      const info = await transport.sendMail({
        from: effectiveFromName
          ? `"${effectiveFromName}" <${effectiveFromEmail}>`
          : effectiveFromEmail,
        to,
        subject,
        text: message,
        html,
      });

      return {
        messageId: info.messageId,
      };
    },
  };
}
