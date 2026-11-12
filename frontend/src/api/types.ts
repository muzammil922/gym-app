/** Domain types for Gym Management API */

export type Role = 'owner' | 'manager' | 'trainer' | 'receptionist' | 'member';

export type Gender = 'male' | 'female' | 'other';

export type PaymentMethod = 'cash' | 'easypaisa' | 'jazzcash' | 'bank';

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export type EnrollmentStatus = 'synced' | 'pending' | 'failed';

export type AttendanceStatus =
  | 'check_in'
  | 'check_out'
  | 'leave'
  | 'absent'
  | 'valid'
  | 'expired'
  | 'unpaid'
  | 'frozen';

export type StaffAttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export type SalaryStatus = 'paid' | 'unpaid';

export type MessageStatus = 'sent' | 'failed' | 'pending' | 'queued';

export type ThemeMode = 'light' | 'dark' | 'system';

export type AppLanguage = 'en' | 'ur_roman';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  avatarUrl?: string;
  gymId: string;
  memberId?: string;
  staffId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

export interface GymProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  logoUrl?: string;
  timezone: 'Asia/Karachi';
  currency: 'PKR';
  easypaisaNumber?: string;
  jazzcashNumber?: string;
  bankName?: string;
  bankAccountTitle?: string;
  bankAccountNumber?: string;
  iban?: string;
}

export interface Plan {
  id: string;
  name: string;
  durationDays: number;
  pricePkr: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  discountPercent?: number;
  discountAmountPkr?: number;
  validFrom: string;
  validTo: string;
  planIds: string[];
  isActive: boolean;
  autoSuggest: boolean;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  whatsappPhone: string;
  photoUrl?: string;
  gender: Gender;
  dateOfBirth: string;
  planId: string;
  planName: string;
  startDate: string;
  endDate: string;
  trainerId?: string;
  trainerName?: string;
  offerId?: string;
  offerTitle?: string;
  status: 'active' | 'expired' | 'frozen' | 'cancelled';
  paymentStatus: PaymentStatus;
  outstandingPkr: number;
  whatsappOptIn: boolean;
  remindersEnabled: boolean;
  enrollmentStatus: EnrollmentStatus;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberPayload {
  name: string;
  phone: string;
  whatsappPhone: string;
  photoUri?: string;
  gender: Gender;
  dateOfBirth: string;
  planId: string;
  startDate: string;
  trainerId?: string;
  offerId?: string;
  openingPaymentPkr: number;
  /** Extra advance collected with opening fee — one combined invoice. */
  advancePkr?: number;
  paymentMethod: PaymentMethod;
  whatsappOptIn: boolean;
}

export interface UpdateMemberPayload {
  name: string;
  phone: string;
  whatsappPhone: string;
  photoUri?: string;
  gender: Gender;
  dateOfBirth: string;
  trainerId?: string;
  whatsappOptIn: boolean;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberPhotoUrl?: string;
  checkedInAt: string;
  source: 'device' | 'manual';
  deviceId?: string;
  deviceName?: string;
  direction?: 'in' | 'out';
  status: AttendanceStatus;
  reason?: string;
  recordedBy?: string;
}

export interface AttendanceDevice {
  id: string;
  name: string;
  serialNumber: string;
  location: string;
  isOnline: boolean;
  lastSeenAt: string;
  enrolledCount: number;
}

export interface Payment {
  id: string;
  invoiceId?: string;
  memberId: string;
  memberName: string;
  memberPhotoUrl?: string;
  invoiceNumber: string;
  amountPkr: number;
  discountPkr: number;
  paidPkr: number;
  duePkr: number;
  method: PaymentMethod;
  status: PaymentStatus;
  planId?: string;
  planName?: string;
  offerId?: string;
  notes?: string;
  collectedBy: string;
  paidAt: string;
  createdAt: string;
}

export interface CollectPaymentPayload {
  memberId: string;
  amountPkr: number;
  discountPkr?: number;
  method: PaymentMethod;
  planId?: string;
  offerId?: string;
  notes?: string;
  renew?: boolean;
}

export interface Invoice {
  payment: Payment;
  gym: GymProfile;
  member: Pick<Member, 'id' | 'name' | 'phone' | 'planName'>;
}

export interface DueItem {
  memberId: string;
  memberName: string;
  phone: string;
  outstandingPkr: number;
  planName: string;
  endDate: string;
  daysOverdue: number;
}

export interface FeeReportPoint {
  label: string;
  amountPkr: number;
}

export interface FeeReport {
  totalCollectedPkr: number;
  totalDuePkr: number;
  byMethod: FeeReportPoint[];
  byDay: FeeReportPoint[];
  period: string;
}

export interface DietMeal {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  notes?: string;
}

export interface DietTemplate {
  id: string;
  name: string;
  description: string;
  meals: DietMeal[];
  createdBy: string;
  updatedAt: string;
}

export interface DietAssignment {
  id: string;
  memberId: string;
  memberName: string;
  templateId: string;
  templateName: string;
  startDate: string;
  endDate?: string;
  whatsappReminders: boolean;
  checkoffs: DietCheckoff[];
}

export interface DietCheckoff {
  id: string;
  date: string;
  mealId: string;
  mealName: string;
  completed: boolean;
  completedAt?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment?: string;
  instructions?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WorkoutDay {
  day: Weekday;
  title?: string;
  notes?: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    sets: number;
    reps: string;
    restSec?: number;
    muscleGroup?: string;
    instructions?: string;
    imageUrl?: string;
    videoUrl?: string;
  }>;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  days: WorkoutDay[];
  createdBy: string;
  updatedAt: string;
}

export interface WorkoutAssignment {
  id: string;
  memberId: string;
  memberName: string;
  planId: string;
  planName: string;
  startDate: string;
  streakDays: number;
  completions: WorkoutCompletion[];
}

export interface WorkoutCompletion {
  id: string;
  date: string;
  day: Weekday;
  completed: boolean;
  completedBy?: 'member' | 'trainer';
  completedAt?: string;
  notes?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: Exclude<Role, 'member'>;
  designation?: string;
  salaryPkr: number;
  salaryStatus: SalaryStatus;
  joinDate: string;
  isActive: boolean;
  assignedMemberIds: string[];
  photoUrl?: string;
}

export interface StaffAttendance {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  checkInAt?: string;
  checkOutAt?: string;
  status: StaffAttendanceStatus;
}

export interface WhatsAppSettings {
  enabled: boolean;
  providerConnected: boolean;
  welcomeTemplateReady: boolean;
  paymentReminderTemplateReady: boolean;
  expiryReminderTemplateReady: boolean;
  dietReminderTemplateReady: boolean;
  paymentDetailsInclude: boolean;
  gymInfoInclude: boolean;
}

export interface WhatsAppTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
  language: string;
  metaTplId?: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface WhatsAppMessage {
  id: string;
  memberId?: string;
  memberName?: string;
  phone: string;
  template: string;
  body: string;
  status: MessageStatus;
  createdAt: string;
  error?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'attendance' | 'payment' | 'expiry' | 'system' | 'whatsapp';
  read: boolean;
  createdAt: string;
  data?: Record<string, string>;
}

export interface DashboardStats {
  todayCheckIns: number;
  activeMembers: number;
  expiringIn7Days: number;
  todayCollectionPkr: number;
  pendingDuesPkr: number;
  pendingEnrollments: number;
  recentCheckIns: AttendanceRecord[];
  expiringMembers: Array<Pick<Member, 'id' | 'name' | 'endDate' | 'planName' | 'photoUrl'>>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ApiErrorBody {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface OtpRequestPayload {
  phone: string;
}

export interface OtpVerifyPayload {
  phone: string;
  otp: string;
}

export interface FreezePayload {
  memberId: string;
  days: number;
  reason: string;
}

export interface ManualCheckInPayload {
  memberId: string;
  reason?: string;
  status?: AttendanceStatus;
  direction?: 'in' | 'out';
  checkedInAt?: string;
}

export interface UpdateAttendancePayload {
  status?: AttendanceStatus;
  direction?: 'in' | 'out';
  checkedInAt?: string;
  reason?: string;
}

export interface RenewMemberPayload {
  memberId: string;
  planId: string;
  offerId?: string;
  paymentPkr: number;
  method: PaymentMethod;
  startDate?: string;
}
