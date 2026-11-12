# Gym Management API Contract

Base URL: `EXPO_PUBLIC_API_URL` (default `http://localhost:3000/api`)

Auth: `Authorization: Bearer <accessToken>` on protected routes.

Currency: **PKR**. Timezone: **Asia/Karachi**.

Mock mode: `EXPO_PUBLIC_USE_MOCK=true` serves the in-app adapter (`src/mocks/handlers.ts`).

---

## Auth

### POST `/auth/login`
Request: `{ phone: string, password: string }`  
Response: `{ user: User, tokens: AuthTokens }`

### POST `/auth/otp/request`
Request: `{ phone: string }`  
Response: `{ ok: true, demoOtp?: string }`

### POST `/auth/otp/verify`
Request: `{ phone: string, otp: string }`  
Response: `{ user: User, tokens: AuthTokens }`

### POST `/auth/refresh`
Request: `{ refreshToken: string }`  
Response: `{ user: User, tokens: AuthTokens }`

### POST `/auth/logout`
Request: empty  
Response: `{ ok: true }`

### GET `/auth/me`
Response: `User`

---

## Gym / Settings

### GET `/gym`
Response: `GymProfile`

### PUT `/gym`
Request: `Partial<GymProfile>`  
Response: `GymProfile`

---

## Dashboard

### GET `/dashboard`
Response: `DashboardStats`

---

## Members

### GET `/members`
Query: `q?, status?, paymentStatus?, page?, pageSize?`  
Response: `Paginated<Member>`

### GET `/members/:id`
Response: `Member`

### POST `/members`
Request: `CreateMemberPayload`  
Response: `{ member: Member, whatsappNote: string }`

### DELETE `/members/:id`
Response: `{ ok: true }`

### POST `/members/:id/resync`
Response: `Member` (enrollmentStatus synced)

### POST `/members/:id/freeze`
Request: `FreezePayload`  
Response: `Member`

### POST `/members/:id/renew`
Request: `RenewMemberPayload`  
Response: `{ member: Member, payment: Payment }`

### PATCH `/members/:id/reminders`
Request: `{ enabled: boolean }`  
Response: `Member`

### GET `/members/:id/attendance`
Response: `AttendanceRecord[]`

### GET `/members/:id/payments`
Response: `Payment[]`

---

## Attendance

### GET `/attendance/live`
Response: `AttendanceRecord[]` (today)

### GET `/attendance`
Query: `date=YYYY-MM-DD`  
Response: `AttendanceRecord[]`

### POST `/attendance/manual`
Request: `ManualCheckInPayload`  
Response: `AttendanceRecord`

### GET `/attendance/devices`
Response: `AttendanceDevice[]`

### POST `/attendance/devices/:id/ping`
Response: `AttendanceDevice`

---

## Plans / Fees

### GET `/plans`
Response: `Plan[]`

### POST `/plans`
Request: `Partial<Plan>`  
Response: `Plan`

### PUT `/plans/:id`
Request: `Partial<Plan>`  
Response: `Plan`

### DELETE `/plans/:id`
Response: `{ ok: true }`

### POST `/payments`
Request: `CollectPaymentPayload`  
Response: `{ payment: Payment, invoice: Invoice }`

### GET `/payments`
Response: `Payment[]`

### GET `/payments/:id/invoice`
Response: `Invoice`

### POST `/payments/:id/whatsapp`
Response: `WhatsAppMessage`

### GET `/dues`
Response: `DueItem[]`

### GET `/reports/fees`
Response: `FeeReport`

---

## Offers

### GET `/offers`
Query: `active?`  
Response: `Offer[]`

### GET `/offers/suggest`
Query: `planId`  
Response: `Offer[]`

### POST `/offers`
Request: `Partial<Offer>`  
Response: `Offer`

### PUT `/offers/:id`
Request: `Partial<Offer>`  
Response: `Offer`

### DELETE `/offers/:id`
Response: `{ ok: true }`

---

## Diet

### GET `/diet/templates`
Response: `DietTemplate[]`

### POST `/diet/templates`
Request: `Partial<DietTemplate>`  
Response: `DietTemplate`

### GET `/diet/assignments`
Query: `memberId?`  
Response: `DietAssignment[]`

### POST `/diet/assignments`
Request: `{ memberId, templateId, whatsappReminders? }`  
Response: `DietAssignment`

### POST `/diet/checkoffs/:id/toggle`
Response: `DietAssignment`

---

## Workout

### GET `/workout/exercises`
Response: `Exercise[]`

### POST `/workout/exercises`
Request: `Partial<Exercise>`  
Response: `Exercise`

### GET `/workout/plans`
Response: `WorkoutPlan[]`

### POST `/workout/plans`
Request: `Partial<WorkoutPlan>`  
Response: `WorkoutPlan`

### GET `/workout/assignments`
Query: `memberId?`  
Response: `WorkoutAssignment[]`

### POST `/workout/assignments`
Request: `{ memberId, planId }`  
Response: `WorkoutAssignment`

### POST `/workout/assignments/:id/complete`
Request: `{ day: Weekday, completedBy?: 'member'|'trainer' }`  
Response: `WorkoutAssignment`

---

## Staff

### GET `/staff`
Response: `StaffMember[]`

### POST `/staff`
Request: `Partial<StaffMember>`  
Response: `StaffMember`

### PUT `/staff/:id`
Request: `Partial<StaffMember>`  
Response: `StaffMember`

### DELETE `/staff/:id`
Response: `{ ok: true }`

### POST `/staff/:id/salary`
Request: `{ status: 'paid'|'unpaid' }`  
Response: `StaffMember`

### GET `/staff/attendance`
Query: `date?`  
Response: `StaffAttendance[]`

### POST `/staff/attendance`
Request: `Partial<StaffAttendance>`  
Response: `StaffAttendance`

---

## WhatsApp

### GET `/whatsapp/settings`
Response: `WhatsAppSettings`

### PUT `/whatsapp/settings`
Request: `Partial<WhatsAppSettings>`  
Response: `WhatsAppSettings`

### GET `/whatsapp/messages`
Response: `WhatsAppMessage[]`

---

## Notifications

### GET `/notifications`
Response: `AppNotification[]`

### POST `/notifications/:id/read`
Response: `AppNotification`

### POST `/notifications/read-all`
Response: `{ ok: true }`
