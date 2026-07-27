import { getBusinessEmailTransportConfig } from './configStore.mjs';
import { createSmtpProvider } from './providers/smtpProvider.mjs';

export function createBusinessEmailService() {
  return {
    async sendEmail(payload) {
      const config = await getBusinessEmailTransportConfig(payload.businessId);
      const provider = createSmtpProvider(config);

      return provider.sendEmail({
        to: payload.to,
        subject: payload.subject,
        message: payload.message,
        businessName: payload.businessName,
        logoUrl: payload.logoUrl,
        fromEmailOverride: payload.fromEmailOverride,
        fromNameOverride: payload.fromNameOverride,
      });
    },
  };
}
