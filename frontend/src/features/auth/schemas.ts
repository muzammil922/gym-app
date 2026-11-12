import { z } from 'zod';

export const loginSchema = z.object({
  phone: z
    .string()
    .min(11, 'Enter a valid phone number')
    .regex(/^03\d{9}$/, 'Use format 03XXXXXXXXX'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const otpPhoneSchema = z.object({
  phone: z
    .string()
    .min(11, 'Enter a valid phone number')
    .regex(/^03\d{9}$/, 'Use format 03XXXXXXXXX'),
});

export const otpVerifySchema = z.object({
  phone: z.string(),
  otp: z.string().length(6, 'Enter the 6-digit OTP'),
});

export const setPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm your password'),
}).refine((v) => v.password === v.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type LoginForm = z.infer<typeof loginSchema>;
export type SetPasswordForm = z.infer<typeof setPasswordSchema>;
