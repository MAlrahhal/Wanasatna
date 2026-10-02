import { z } from 'zod';
import { playerNameContainsForbiddenChars, type AuthActionResponse } from '@wanasatna/shared';

export const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .refine((email) => email.length >= 3 && email.length <= 254, {
    message: 'يرجى إدخال بريد إلكتروني صالح.',
  })
  .refine((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), {
    message: 'يرجى إدخال بريد إلكتروني صالح.',
  });

const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
  .max(128, 'كلمة المرور طويلة جداً.');

const preferredDisplayNameSchema = z
  .string()
  .trim()
  .min(2, 'الاسم يجب أن يكون حرفين على الأقل.')
  .max(20, 'الاسم يجب أن يكون 20 حرفاً كحد أقصى.')
  .refine((name) => !playerNameContainsForbiddenChars(name), {
    message: 'الاسم يحتوي على رموز غير مسموحة.',
  });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  preferredDisplayName: preferredDisplayNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const adminMfaVerificationSchema = z.object({
  challengeToken: z
    .string()
    .min(32)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  method: z.enum(['totp', 'recovery']),
  code: z.string().trim().min(6).max(64),
});

export const purchaserOtpRequestSchema = z.object({
  email: emailSchema,
});

export const purchaserOtpVerificationSchema = z.object({
  challengeId: z
    .string()
    .min(32)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  code: z.string().regex(/^\d{6}$/, 'أدخل الرمز المكوّن من 6 أرقام.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminMfaVerificationInput = z.infer<typeof adminMfaVerificationSchema>;
export type PurchaserOtpRequestInput = z.infer<typeof purchaserOtpRequestSchema>;
export type PurchaserOtpVerificationInput = z.infer<typeof purchaserOtpVerificationSchema>;

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = Extract<AuthActionResponse<never>, { success: false }>;

function validationError(message: string): ValidationFailure {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
    },
  };
}

function validatePayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): ValidationSuccess<T> | ValidationFailure {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid request payload';
    return validationError(message);
  }

  return {
    success: true,
    data: result.data,
  };
}

export function validateRegisterPayload(payload: unknown) {
  return validatePayload(registerSchema, payload);
}

export function validateLoginPayload(payload: unknown) {
  return validatePayload(loginSchema, payload);
}

export function validateAdminMfaVerificationPayload(payload: unknown) {
  return validatePayload(adminMfaVerificationSchema, payload);
}

export function validatePurchaserOtpRequestPayload(payload: unknown) {
  return validatePayload(purchaserOtpRequestSchema, payload);
}

export function validatePurchaserOtpVerificationPayload(payload: unknown) {
  return validatePayload(purchaserOtpVerificationSchema, payload);
}
