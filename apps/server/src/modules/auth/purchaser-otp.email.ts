export type PurchaserOtpEmail = {
  to: string;
  code: string;
  expiresInMinutes: number;
  challengeId: string;
  version: number;
};

export type PurchaserOtpEmailTransport = {
  isConfigured(): boolean;
  send(message: PurchaserOtpEmail): Promise<void>;
};

type ResendEmailTransportOptions = {
  apiKey: string | undefined;
  from: string | undefined;
  fetchImpl?: typeof fetch;
};

const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 10_000;

function configured(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function purchaserOtpEmailText(code: string, expiresInMinutes: number): string {
  return [
    'رمز الدخول إلى وناستنا',
    '',
    `رمزك: ${code}`,
    '',
    'استخدم هذا الرمز لإثبات ملكية بريدك عند الدخول أو استعادة حساب المشتري.',
    `ينتهي الرمز خلال ${expiresInMinutes} دقائق ويُستخدم مرة واحدة فقط.`,
    'التحقق من البريد لا يمنح أي مزايا مدفوعة تلقائيًا.',
    'إذا لم تطلب هذا الرمز فتجاهل الرسالة.',
  ].join('\n');
}

export function createResendPurchaserOtpEmailTransport(
  options: ResendEmailTransportOptions,
): PurchaserOtpEmailTransport {
  const apiKey = configured(options.apiKey);
  const from = configured(options.from);
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    isConfigured() {
      return Boolean(apiKey && from);
    },

    async send(message) {
      if (!apiKey || !from) {
        throw new Error('Purchaser OTP email delivery is not configured.');
      }

      const response = await fetchImpl(RESEND_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `purchaser-otp/${message.challengeId}/${message.version}`,
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: 'رمز الدخول إلى وناستنا',
          text: purchaserOtpEmailText(message.code, message.expiresInMinutes),
        }),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error('Purchaser OTP email delivery failed.');
      }
    },
  };
}
