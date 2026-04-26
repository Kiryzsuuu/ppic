# 05 — API Reference

Dokumen ini merangkum endpoint utama. Semua endpoint berada di `src/app/api/**`.

## A) Konvensi

- Base path: `/api/...`
- Response JSON konsisten via `src/lib/http.ts`.
- Role guard:
  - Banyak endpoint memakai `requireRole([...])` dari `src/lib/rbac.ts`.

### Format response

- Sukses:

```json
{ "ok": true, "data": { "...": "..." } }
```

- Error:

```json
{ "ok": false, "error": { "message": "...", "details": "...optional..." } }
```

### Auth

- Cookie session: `ppic_session` (httpOnly)
- Banyak endpoint mensyaratkan login (401) atau role tertentu (403)

---

## B) Auth

Folder: `src/app/api/auth/`

### 1) `POST /api/auth/register`

Membuat user baru role `USER` dan langsung set session cookie.

Request:

```json
{
  "username": "user_1",
  "password": "secret123",
  "fullName": "Nama Lengkap",
  "email": "user@example.com",
  "phone": "+62...",
  "address": "...",
  "placeOfBirth": "...",
  "dateOfBirth": "2026-01-31",
  "ktpNumber": "..."
}
```

Response sukses (ringkas):

```json
{ "ok": true, "data": { "user": { "id": "...", "username": "...", "role": "USER" } } }
```

Error umum:
- 409 jika username/email sudah digunakan
- 400 jika input tidak valid

### 2) `POST /api/auth/login`

Login menggunakan `identifier` (username atau email) dan password.

Request:

```json
{ "identifier": "admin", "password": "admin123" }
```

Response sukses:

```json
{
  "ok": true,
  "data": {
    "user": { "id": "...", "username": "admin", "role": "ADMIN", "emailVerified": true }
  }
}
```

Error umum:
- 401 jika credential salah

### 3) `POST /api/auth/logout`

Menghapus cookie `ppic_session`.

### 4) Email OTP

`POST /api/auth/otp/request`
- Butuh login
- Mengirim OTP ke email (best-effort tergantung konfigurasi mail)

`POST /api/auth/otp/verify`
- Butuh login
- Request: `{ "code": "123456" }`
- Jika sukses, refresh session agar `emailVerified=true`

### 5) Reset password (OTP-based)

`POST /api/auth/password-reset/request`
- Request: `{ "email": "user@example.com" }`
- Selalu return ok (untuk mencegah email enumeration)

`POST /api/auth/password-reset/verify-otp`
- Request: `{ "email": "user@example.com", "code": "123456" }`
- Jika sukses, set cookie httpOnly `ppic_pwreset` (TTL 15 menit)

`POST /api/auth/password-reset/confirm`
- Request: `{ "newPassword": "secret123" }`
- Token reset diambil dari body `token` (opsional) atau cookie `ppic_pwreset`

---

## C) Public

Folder: `src/app/api/public/`

### 1) `GET /api/public/simulators`

Response:

```json
{
  "ok": true,
  "data": { "simulators": [ { "id": "...", "category": "BOEING", "name": "..." } ] }
}
```

### 2) `GET /api/public/slots`

Query params:
- `simulatorId` (opsional)
- `from` (opsional, ISO date)
- `to` (opsional, ISO date)

Catatan behavior:
- Slot WET berasal dari `ScheduleSlot`.
- Booking DRY yang sudah `CONFIRMED/COMPLETED` diekspos sebagai blok sintetis dengan id `booking:<id>`.

Response (ringkas):

```json
{
  "ok": true,
  "data": {
    "slots": [
      {
        "id": "...",
        "startAt": "2026-...",
        "endAt": "2026-...",
        "status": "AVAILABLE",
        "leaseType": "WET",
        "simulator": { "category": "BOEING", "name": "..." }
      }
    ]
  }
}
```

### 3) `GET /api/public/landing`

Mengembalikan konfigurasi landing yang tersimpan di DB (AppSetting):
- `landing.hero.slides`
- `landing.simulator.logos`

Response:

```json
{ "ok": true, "data": { "config": { "heroSlides": [], "simulatorLogos": { "airbusLogoSrc": "..." } } } }
```

Header:
- `Cache-Control: no-store`

### 4) `GET /api/public/landing-images/[name]`

Mengambil file image dari disk (folder `UPLOAD_DIR/landing`).

Catatan:
- Nama file divalidasi (tidak boleh traversal).
- Response diberi cache header panjang (`immutable`).

### 5) Cron reminders

`GET/POST /api/public/cron/reminders/run`

Auth:
- Jika `REMINDER_CRON_SECRET` kosong → di dev boleh tanpa auth.
- Di production: jika `REMINDER_CRON_SECRET` belum di-set → endpoint return 500 (server not configured).

Header auth yang diterima:
- `x-cron-secret: <secret>` atau
- `Authorization: Bearer <secret>`

Query params:
- `dryRun=1|true` (opsional)
- `limit=<n>` (opsional)

Response: lihat `src/lib/reminders.ts` (mengembalikan statistik scanned/sent/skipped dan daftar error).

---

## D) Documents

Folder: `src/app/api/documents/`

### 1) `POST /api/documents/upload`

Auth:
- Butuh login
- Role yang diizinkan: `USER`, `ADMIN`, `FINANCE`, `INSTRUCTOR`

Request:
- `multipart/form-data`
- Fields:
  - `type`: `LICENSE | MEDICAL | ID | LOGBOOK | PHOTO | CV`
  - `file`: File

Validasi mime:
- `PHOTO` harus `image/jpeg` atau `image/png`
- Selain `PHOTO` harus `application/pdf`

Response sukses:

```json
{ "ok": true, "data": { "document": { "id": "...", "type": "LICENSE", "status": "PENDING" } } }
```

Catatan:
- File disimpan ke disk di folder `UPLOAD_DIR` (default `uploads`).
- Dokumen `PHOTO` auto `APPROVED`, lainnya `PENDING`.

### 2) `GET /api/documents`

Query params:
- `mine=1` (opsional) untuk ambil dokumen milik user saat ini.

Behavior:
- Role `USER` selalu hanya melihat dokumennya sendiri.
- Staff role mendapatkan 50 dokumen terbaru (untuk UI verifikasi).

### 3) `GET /api/documents/[id]/download`

Auth:
- USER hanya boleh download dokumen miliknya.
- Staff role boleh download untuk kebutuhan verifikasi.

Response:
- Binary file dengan header `Content-Type` dan `Content-Disposition: inline`.

---

## E) Bookings (User)

Folder: `src/app/api/bookings/`

### 1) `GET /api/bookings`

Auth: role `USER`.

Mengembalikan list booking user + relasi penting:
- simulator
- payment
- slot
- certificate

### 2) `POST /api/bookings`

Auth: role `USER`.

Syarat:
- Email user harus sudah terverifikasi (`User.emailVerifiedAt` ada), jika tidak → 403.

Request (ringkas):

```json
{
  "simulatorId": "...",
  "leaseType": "WET",
  "trainingCode": "PPC",
  "trainingName": "PPC A320",
  "personCount": 1,
  "paymentMethod": "QRIS",
  "requestedStartAt": "2026-04-08T07:30:00.000Z",
  "requestedEndAt": "2026-04-08T11:30:00.000Z"
}
```

Aturan penting:
- Untuk `WET`:
  - `trainingCode` harus `PPC | TYPE_RATING | OTHER`
  - `personCount` wajib 1 atau 2
  - `requestedStartAt/requestedEndAt` wajib
- Untuk `DRY`:
  - `deviceType` wajib (`FFS | FTD`)
  - `preferredSlotId` tidak boleh diisi
  - `requestedStartAt/requestedEndAt` wajib
  - sistem menormalisasi training menjadi `Dry Leased (<deviceType>)`

Response sukses:
- `booking` dibuat dengan status awal `DRAFT`.

### 3) `POST /api/bookings/[id]/submit`

Auth: role `USER` dan harus owner booking.

Behavior:
- Hanya bisa jika status masih `DRAFT`.
- Untuk booking `WET`, sistem cek dokumen wajib: `LICENSE`, `MEDICAL`, `ID`.
  - Pengecualian hanya jika email user termasuk allowlist `DOCS_BYPASS_EMAILS`.
- Jika lolos, status berubah menjadi `WAIT_ADMIN_VERIFICATION`.
- Best-effort: buat notification + kirim email.

### 4) `POST /api/bookings/[id]/select-slot`

Auth: role `USER` dan harus owner booking.

Request:

```json
{ "slotId": "..." }
```

Syarat:
- Pembayaran harus `VALIDATED` sebelum memilih slot.
- Slot harus `AVAILABLE` dan sesuai simulator booking.
- Untuk `WET`, slot harus jatuh ke sesi tetap (pagi/siang). Jika tidak, request ditolak.
- Untuk `WET`, selection juga ditolak jika sesi bentrok dengan booking `DRY` yang sudah `CONFIRMED/COMPLETED`.

Jika sukses:
- Slot di-update menjadi `BOOKED` dan `bookingId` diisi.
- Booking di-update menjadi `CONFIRMED`.

### 5) `GET /api/bookings/[id]`

Auth:
- Owner boleh akses booking-nya.
- Staff role (non-USER) juga boleh akses untuk kebutuhan verifikasi/operasional.

Relasi yang di-include:
- simulator, payment, slot, legalDocument, logbookEntries, certificate, user

---

## F) Endpoint lain (ringkas)

Bagian di atas menjelaskan endpoint yang paling sering dipakai UI beserta behavior pentingnya.
Di bawah ini adalah daftar endpoint lain yang ada di repo (tanpa contoh request/response lengkap).

### 1) Me / Profile

- `GET /api/me`
- `GET/POST /api/profile`

### 2) Admin: Slots

- `GET/POST /api/admin/slots`
- `PATCH/DELETE /api/admin/slots/[id]`
- `POST /api/admin/slots/bulk`

### 3) Admin/Staff: Bookings

- `POST /api/admin/bookings/[id]/approve`
- `POST /api/admin/bookings/[id]/certificate`
- `POST /api/admin/bookings/staff-book`

### 4) Instructor

- `POST /api/instructor/bookings/staff-book`

### 5) Payments

- `GET /api/payments`
- `POST /api/payments/[id]/mark-paid`

Finance:
- `GET /api/finance/payments`
- `GET /api/finance/payments/[id]/proof`
- `POST /api/finance/payments/[id]/validate`

### 6) Legal Documents (Finance)

- `GET /api/finance/legal-documents`
- `POST /api/finance/legal-documents/[id]/upload`
- `GET /api/finance/legal-documents/[id]/download`

### 7) Notifications

- `GET /api/notifications`
- `POST /api/notifications/[id]/read`

### 8) Audit Logs (Admin)

- `GET /api/admin/logs`
- `GET /api/admin/logs/export`

### 9) Landing Config & Images

- `GET /api/public/landing`
- `GET /api/public/landing-images/[name]`

Admin:
- `GET/POST /api/admin/landing`
- `POST /api/admin/landing-images/upload`

### 10) Cron reminders

- `GET/POST /api/public/cron/reminders/run`
