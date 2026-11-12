import { z } from 'zod';

export const addMemberSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().regex(/^03\d{9}$/, 'Use 03XXXXXXXXX'),
  whatsappPhone: z.string().regex(/^03\d{9}$/, 'Use 03XXXXXXXXX'),
  gender: z.enum(['male', 'female', 'other']),
  dateOfBirth: z.string().min(8, 'DOB required (YYYY-MM-DD)'),
  planId: z.string().min(1, 'Select a plan'),
  startDate: z.string().min(8, 'Start date required'),
  trainerId: z.string().optional(),
  offerId: z.string().optional(),
  openingPaymentPkr: z.number().min(0),
  advancePkr: z.number().min(0),
  paymentMethod: z.enum(['cash', 'easypaisa', 'jazzcash', 'bank']),
  whatsappOptIn: z.boolean(),
});

export type AddMemberForm = z.infer<typeof addMemberSchema>;

export const editMemberSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().regex(/^03\d{9}$/, 'Use 03XXXXXXXXX'),
  whatsappPhone: z.string().regex(/^03\d{9}$/, 'Use 03XXXXXXXXX'),
  gender: z.enum(['male', 'female', 'other']),
  dateOfBirth: z.string().min(8, 'DOB required (YYYY-MM-DD)'),
  trainerId: z.string().optional(),
  whatsappOptIn: z.boolean(),
});

export type EditMemberForm = z.infer<typeof editMemberSchema>;
