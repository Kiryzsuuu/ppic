# 05 — API Reference

Dokumen ini merangkum endpoint utama. Semua endpoint berada di `src/app/api/**`.

## A) Konvensi

- Base path: `/api/...`
- Response JSON konsisten via `src/lib/http.ts`.
- Role guard:
  - Banyak endpoint memakai `requireRole([...])` dari `src/lib/rbac.ts`.

## B) Auth

Folder: `src/app/api/auth/`

- `POST /api/auth/register`
  - Membuat user baru (umumnya role USER)

- `POST /api/auth/login`
  - Login, set cookie `ppic_session`

- `POST /api/auth/logout`
  - Hapus cookie `ppic_session`

- `POST /api/auth/otp/request`
  - Kirim OTP verifikasi email

- `POST /api/auth/otp/verify`
  - Verifikasi OTP

- `POST /api/auth/password-reset/request`
  - Minta reset password (token/link atau OTP tergantung flow)

- `POST /api/auth/password-reset/verify-otp`
  - Verifikasi OTP reset password

- `POST /api/auth/password-reset/confirm`
  - Konfirmasi reset password

## C) Me / Profile

- `GET /api/me`
  - Mengembalikan info user login + info profil ringkas

- `GET/POST /api/profile`
  - Mengambil/mengubah data profil

## D) Documents

- `POST /api/documents/upload`
  - Upload dokumen user (file + metadata)

- `GET /api/documents/[id]/download`
  - Download dokumen

- `GET /api/documents`
  - List dokumen (bergantung implementasi route)

## E) Simulators & Slots

- `GET /api/public/simulators`
- `GET /api/public/slots`

Endpoint public ini dipakai di landing/schedule preview.

Admin/Staff biasanya punya endpoint khusus untuk kelola slot:
- `GET/POST /api/admin/slots`
- `PATCH/DELETE /api/admin/slots/[id]`
- `POST /api/admin/slots/bulk`

## F) Bookings

User:
- `GET /api/bookings` (list)
- `GET /api/bookings/[id]` (detail)
- `POST /api/bookings/[id]/submit` (submit draft)
- `POST /api/bookings/[id]/select-slot` (memilih slot)

Admin/Staff:
- `POST /api/admin/bookings/[id]/approve`
- `POST /api/admin/bookings/[id]/certificate`
- `POST /api/admin/bookings/staff-book`

Instructor:
- `POST /api/instructor/bookings/staff-book`

## G) Payments

- `GET /api/payments`
- `POST /api/payments/[id]/mark-paid`

Finance:
- `GET /api/finance/payments`
- `GET /api/finance/payments/[id]/proof` (lihat bukti bayar)
- `POST /api/finance/payments/[id]/validate` (validasi / reject)

## H) Legal Documents (Finance)

- `GET /api/finance/legal-documents`
- `POST /api/finance/legal-documents/[id]/upload`
- `GET /api/finance/legal-documents/[id]/download`

## I) Notifications

- `GET /api/notifications`
- `POST /api/notifications/[id]/read`

## J) Audit Logs (Admin)

- `GET /api/admin/logs`
- `GET /api/admin/logs/export`

Audit log menyimpan:
- `ip`
- `userAgent`
- `metadata.deviceId` (device id cookie)

## K) Landing Config & Images

Public landing config:
- `GET /api/public/landing`

Admin mengelola landing:
- `GET/POST /api/admin/landing`
- `POST /api/admin/landing-images/upload`

Asset landing image disajikan dari:
- `GET /api/public/landing-images/[name]`

## L) Cron Reminders

Endpoint:
- `GET/POST /api/public/cron/reminders/run`

Header auth (jika `REMINDER_CRON_SECRET` diset):
- `x-cron-secret: <secret>`
atau
- `Authorization: Bearer <secret>`

Query:
- `dryRun=1` untuk simulasi
- `limit=<n>` untuk batasi jumlah proses
