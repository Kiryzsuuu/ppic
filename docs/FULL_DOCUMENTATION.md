# PPI Curug Simulator Training — Full Documentation

> Generated on: 2026-04-08 05.14.39

Dokumen ini menggabungkan seluruh dokumentasi di folder docs/.

---

# Dokumentasi — PPI Curug Simulator Training

Dokumentasi ini menjelaskan project **dari nol**: cara setup, routing (Next.js App Router), API routes, autentikasi + RBAC, Prisma + database, hingga panduan penggunaan per role.

## Daftar Dokumen

1) **Quickstart & Setup Lokal**
- Lihat: `docs/01-quickstart.md`

2) **Routing (App Router) & Struktur Folder**
- Lihat: `docs/02-routing.md`

3) **Auth, Session, Email OTP, RBAC**
- Lihat: `docs/03-auth-rbac.md`

4) **Database & Prisma (MongoDB)**
- Lihat: `docs/04-database-prisma.md`

5) **API Reference (ringkas tapi menyeluruh)**
- Lihat: `docs/05-api-reference.md`

6) **Panduan Penggunaan (User/Admin/Finance/Instructor)**
- Lihat: `docs/06-usage-guide.md`

7) **Operasional (Uploads, SMTP, Cron Reminder, Branding)**
- Lihat: `docs/07-ops-branding.md`

## Konvensi Respon API

Hampir semua endpoint API mengembalikan bentuk JSON yang konsisten:

- Sukses:

```json
{ "ok": true, "data": { "...": "..." } }
```

- Gagal:

```json
{ "ok": false, "error": { "message": "...", "details": "...optional..." } }
```

Helper-nya ada di `src/lib/http.ts`.

---

# 01 — Quickstart & Setup Lokal

Dokumen ini menuntun setup lokal dari nol untuk repo ini (Next.js App Router + Prisma + MongoDB).

---

## 1) Prasyarat

- Node.js (LTS disarankan)
- NPM
- Akses MongoDB:
  - **MongoDB Atlas** (disarankan untuk tim), atau
  - **Mongo lokal** (untuk dev cepat)

Catatan Windows:
- Jalankan terminal dengan akses yang cukup untuk menulis folder project (terutama untuk upload file).

---

## 2) Install Dependency

Di root project:

```bash
npm install
```

Catatan:
- Ada script `postinstall` yang otomatis menjalankan `prisma generate`.

---

## 3) Konfigurasi Environment

Buat file `.env` di root project (jangan di-commit). Template ada di `.env.example`.

### A) Minimal wajib

```bash
DATABASE_URL="..."
JWT_SECRET="replace-with-a-long-random-string"
```

### B) Contoh `DATABASE_URL`

**1) MongoDB Atlas**

```bash
DATABASE_URL="mongodb+srv://<user>:<password>@<cluster-host>/<db>?retryWrites=true&w=majority"
```

**2) Mongo lokal**

```bash
DATABASE_URL="mongodb://localhost:27017/ppic"
```

Tips:
- Pastikan bagian `/ppic` adalah nama database yang kamu pakai.
- Untuk Atlas, pastikan IP allowlist & permission user DB sudah benar.

### C) Env opsional yang sering dibutuhkan

**Uploads**

```bash
UPLOAD_DIR="uploads"
```

Jika kamu ubah `UPLOAD_DIR`, pastikan folder tersebut bisa ditulis oleh server.

**URL aplikasi (untuk email link / CTA)**

```bash
APP_URL="http://localhost:3000"
APP_BASE_URL="http://localhost:3000"
```

**SMTP / mail transport**

```bash
MAIL_TRANSPORT="smtp" # smtp | ethereal | log
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="PPI Curug Simulator Training <no-reply@example.com>"
```

Catatan:
- Di mode non-production, beberapa flow email/OTP bisa fallback ke log (tergantung konfigurasi `MAIL_TRANSPORT`).

---

## 4) Inisialisasi Database (Prisma + MongoDB)

Project ini memakai Prisma dengan provider **MongoDB**.

### A) Apply schema ke MongoDB

```bash
npm run prisma:migrate
```

Script ini menjalankan `prisma db push`.

### B) Seed data (akun awal)

```bash
npm run db:seed
```

Seed akan membuat akun system (login by **username**) untuk dev:
- `admin / admin123`
- `finance / finance123`
- `instructor / instructor123`

### C) Fix index unik opsional (jika diperlukan)

Jika kamu mengalami error unique constraint yang aneh pada field opsional (mis. email `null`), jalankan:

```bash
npm run db:fix-mongo-indexes
```

---

## 5) Jalankan Development Server

```bash
npm run dev
```

Buka:
- http://localhost:3000

---

## 6) Akses Aplikasi (Role)

- **USER** dibuat via registrasi (`/register`)
- **ADMIN/FINANCE/INSTRUCTOR** disediakan oleh seed (lihat bagian di atas)

Catatan penting:
- Middleware memaksa user yang belum verifikasi email untuk menyelesaikan OTP sebelum mengakses area aplikasi.

---

## 7) Prisma Studio (Lihat data)

```bash
npm run prisma:studio
```

---

## 8) Build & Run Production (Ringkas)

Build:

```bash
npm run build
```

Run:

```bash
npm start
```

Catatan:
- Pastikan env production benar: `JWT_SECRET`, `DATABASE_URL`, SMTP, dan storage uploads yang persistent.

---

## 9) Script Penting (Cheat Sheet)

Yang sering dipakai saat dev/ops:

- Apply schema: `npm run prisma:migrate`
- Seed: `npm run db:seed`
- Reset DB (hapus data): `npm run db:reset`
- Prisma Studio: `npm run prisma:studio`
- Fix Mongo sparse unique indexes: `npm run db:fix-mongo-indexes`

---

## 10) Troubleshooting

### A) Prisma error EPERM di Windows

Jika muncul error semacam:
`EPERM: operation not permitted, rename ... query_engine-windows.dll.node.tmp`

Penyebab umum: ada proses `node.exe`/`next dev` yang masih mengunci Prisma engine.

Solusi:
1) Stop semua proses `npm run dev`.
2) Pastikan tidak ada `node.exe` yang masih jalan.
3) Jalankan ulang:

```bash
npm run prisma:generate
```

### B) Tidak bisa connect ke MongoDB

Cek:
- `DATABASE_URL` sudah benar
- Atlas: IP allowlist & permission user
- Lokal: service `mongod` hidup + port benar

### C) Unique constraint error padahal field opsional `null`

Jalankan:

```bash
npm run db:fix-mongo-indexes
```

### D) OTP/email tidak terkirim saat dev

Hal yang perlu dicek:
- `MAIL_TRANSPORT` (mis. `log` untuk paksa output ke console)
- Konfigurasi SMTP (jika ingin benar-benar mengirim)
- Lihat output server console untuk pesan best-effort mail (terutama saat non-production)

### E) Upload file gagal

Cek:
- Folder `UPLOAD_DIR` ada dan server bisa menulis
- Jalankan app dari folder project (supaya `process.cwd()` benar)
# 02 — Routing (Next.js App Router) & Struktur Folder

Project ini menggunakan **Next.js App Router**.

## A) Struktur Folder Utama

- `src/app/` → semua **route** (UI pages, layouts) + **route handlers** (API)
- `src/lib/` → util server (prisma, session, rbac, email, audit, dll)
- `prisma/` → schema + seed
- `public/` → static assets (logo, ikon, dll)
- `uploads/` → default lokasi file upload (jika `UPLOAD_DIR` tidak diubah)

## B) Cara Next.js Membangun Route

### 1) Page routes (UI)

Dalam App Router:
- Folder + `page.tsx` menjadi route.
- Folder + `layout.tsx` menjadi layout wrapper untuk subtree.
- Segment dinamis memakai `[param]`, misalnya `user/certificates/[id]/page.tsx` menghasilkan route:
	- `/user/certificates/:id`

Contoh:
- `src/app/page.tsx` → `/`
- `src/app/login/page.tsx` → `/login`

### 2) API routes (Route Handlers)

Dalam App Router:
- Folder `src/app/api/**/route.ts` membentuk endpoint `/api/**`.
- Method ditentukan oleh export function: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

Contoh:
- `src/app/api/auth/login/route.ts` → `POST /api/auth/login`
- `src/app/api/documents/upload/route.ts` → `POST /api/documents/upload`

### 3) Static file routes

- File di `public/` tersedia langsung dari root URL.
	- `public/logoppic/logoppic.7a5aa04c.png` → `/logoppic/logoppic.7a5aa04c.png`

Khusus App Router icons:
- `src/app/icon.png` → `/icon.png` (dipakai sebagai icon/tab/fav di banyak browser).

## C) Peta Route UI (Ringkasan)

> Catatan: sebagian halaman adalah area role tertentu dan dijaga oleh middleware.

### Public

- `/` → landing/home (hero slideshow, info, schedule preview)
- `/login`, `/register`
- `/forgot-password`, `/reset-password`
- `/verify-email`

### General (butuh login)

- `/dashboard`
- `/account` (menu akun)
- `/account/profile` (re-export ke halaman profil user)

### USER

- `/user/dashboard`
- `/user/profile`
- `/user/documents`
- `/user/booking/new`
- `/user/bookings/[id]`
- `/user/certificates/[id]`

### ADMIN

- `/admin/dashboard`
- `/admin/dashboard/report`
- `/admin/landing`
- `/admin/logs`
- `/admin/bookings`
- `/admin/schedule`
- `/admin/users`
- `/admin/verifications`

### FINANCE

- `/finance/dashboard`
- `/finance/dashboard/report`
- `/finance/payments`
- `/finance/legal`

### INSTRUCTOR

- `/instructor/dashboard`
- `/instructor/schedule`
- `/instructor/users`
- `/instructor/logbook`

## D) Middleware & Guard Routing

File: `src/middleware.ts`

Fungsi utama middleware:
1) Menentukan route yang **public** dan **protected**.
2) Jika tidak login → redirect ke `/login?next=...`.
3) Memvalidasi JWT dari cookie session.
4) Memaksa verifikasi email sebelum akses aplikasi (kecuali endpoint OTP + logout).
5) Guard area role:
  - `/admin/*` hanya untuk role `ADMIN`
  - `/finance/*` hanya untuk role `FINANCE`
  - `/instructor/*` hanya untuk role `INSTRUCTOR`
  - `/user/*` hanya untuk role `USER`

### 1) Public assets vs protected pages

Middleware secara eksplisit membiarkan file asset publik (gambar/icon/dll) agar tidak ikut redirect ke `/login`.
Jika kamu melihat gambar/logo jadi “broken” karena redirect, cek rule public assets di middleware.

### 2) Public routes (tidak butuh login)

Contoh route yang diperlakukan public:
- `/` (landing)
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/api/auth/**` (auth + OTP + password reset)
- `/api/public/**` (landing, simulators, slots, cron reminders)

Catatan:
- Walaupun public, middleware tetap menempelkan cookie device id (`ppic_device_id`).

### 3) Session cookie dan apa yang terjadi jika tidak login

- Cookie session bernama: `ppic_session`.
- Jika tidak ada cookie ini dan route bukan public → middleware redirect ke `/login?next=<path>`.

### 4) Email verification gate

Jika token valid tapi `emailVerified=false` di payload JWT:
- User dipaksa ke `/verify-email`.
- Pengecualian: endpoint OTP (`/api/auth/otp/**`) dan `/logout`.

### 5) Role guard untuk area dashboard

Middleware melakukan pengecekan sederhana berbasis prefix path:
- Prefix `/admin` → harus role `ADMIN`
- Prefix `/finance` → harus role `FINANCE`
- Prefix `/instructor` → harus role `INSTRUCTOR`
- Prefix `/user` → harus role `USER`

Jika role tidak sesuai, user diarahkan ke `/dashboard`.

### Cookie yang relevan

- `ppic_session` → JWT session (httpOnly)
- `ppic_device_id` → device id (httpOnly) untuk audit log / pelacakan perangkat

### Matcher

Middleware aktif untuk hampir semua path, dengan pengecualian `_next/static`, `_next/image`, dan `favicon.ico` (lihat `export const config.matcher`).

## E) Responsiveness (UI Routing)

UI menggunakan Tailwind dan komponen di `src/app/*`.
Beberapa route UI berupa “page wrapper” yang re-export.
Contoh:
- `src/app/account/profile/page.tsx` mengekspor default dari `src/app/user/profile/page.tsx`.

Tujuan pola ini: URL `/account/profile` tetap ada, tapi implementasi halaman profil tetap satu sumber.

## F) Detail `route.ts`: ctx.params di Dynamic Segment

Pada route handler dengan segment dinamis, Next.js App Router memberikan params lewat argumen kedua.
Di repo ini Anda akan melihat pola seperti:

```ts
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // ...
}
```

Kenapa `params` bertipe `Promise`?
- Ini mengikuti pola App Router terbaru untuk memastikan params bisa di-resolve secara async.

---

## H) Pola Implementasi Route Handler (Yang Dipakai di Repo)

### 1) Konvensi response JSON

Hampir semua endpoint JSON memakai helper:
- `jsonOk(data)` → `{ ok: true, data }`
- `jsonError(message, status?, details?)` → `{ ok: false, error: { message, details } }`

Helper berada di `src/lib/http.ts`.

### 2) Guard untuk API (session/role)

Untuk memaksa login:

```ts
import { requireSession } from "@/lib/rbac";

const { session, response } = await requireSession();
if (!session) return response;
```

Untuk memaksa role tertentu:

```ts
import { requireRole } from "@/lib/rbac";

const { session, response } = await requireRole(["ADMIN"]);
if (!session) return response;
```

### 3) Catatan server-only

Route handlers (`src/app/api/**/route.ts`) selalu berjalan di server.
Untuk akses DB, import `prisma` dari `src/lib/prisma.ts`.

## G) Cara Menambah Route Baru (Praktis)

### 1) Menambah halaman UI

Misal ingin menambah halaman `/admin/reports`:
1. Buat folder: `src/app/admin/reports/`
2. Buat file: `src/app/admin/reports/page.tsx`

Minimal isi:

```tsx
export default function ReportsPage() {
  return <div>Reports</div>;
}
```

Jika halaman ini harus admin-only:
- Pastikan prefix path-nya `/admin/...` (middleware akan menolak role selain ADMIN).

### 2) Menambah endpoint API

Misal ingin menambah endpoint `GET /api/admin/reports/summary`:
1. Buat folder: `src/app/api/admin/reports/summary/`
2. Buat file: `route.ts`

Contoh pola implementasi yang konsisten di repo:

```ts
import { jsonOk, jsonError } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const { session, response } = await requireRole(["ADMIN"]);
  if (!session) return response;
  try {
    return jsonOk({ message: "ok" });
  } catch (e) {
    return jsonError("Server error", 500);
  }
}
```

### 3) Menambah asset publik

Untuk menambah file statis yang bisa diakses langsung URL:
- Taruh di `public/`.

Contoh:
- `public/brand/logo.png` → bisa diakses lewat `/brand/logo.png`.

---

# 03 — Auth, Session, Email OTP, RBAC

Dokumen ini menjelaskan alur login, session cookie, verifikasi email OTP, reset password, dan RBAC.

## A) Session: Cookie + JWT

File utama:
- `src/lib/session.ts`

### 1) Cookie

Nama cookie session:
- `ppic_session`

Cookie diset sebagai:
- `httpOnly: true`
- `sameSite: "lax"`
- `secure: true` saat production
- `maxAge: 8 jam`

Implementasi ada di `src/lib/session.ts` (`setSessionCookie`).

### 2) JWT Payload

Tipe payload session:

```ts
type SessionPayload = {
  userId: string;
  username: string;
  role: "USER" | "ADMIN" | "FINANCE" | "INSTRUCTOR";
  emailVerified: boolean;
};
```

JWT ditandatangani dengan secret:
- `JWT_SECRET`

JWT expiry:
- 8 jam

Catatan penting:
- `src/lib/session.ts` akan **throw** jika `JWT_SECRET` tidak di-set (karena `getJwtSecret()` wajib ada untuk sign/verify session).
- `src/middleware.ts` lebih “best-effort”: jika `JWT_SECRET` tidak ada, middleware tidak memverifikasi token dan membiarkan request lewat.
  - Ini membantu dev yang belum set env, tapi untuk production sebaiknya selalu set `JWT_SECRET`.

## B) Middleware Guard

File: `src/middleware.ts`

Yang dilakukan middleware:
1) Mengecualikan route public + static assets.
2) Jika route protected dan tidak ada cookie `ppic_session` → redirect ke `/login?next=...`.
3) Jika ada token dan `JWT_SECRET` tersedia → verifikasi token.
4) Jika `emailVerified=false` → paksa redirect ke `/verify-email` (kecuali endpoint OTP dan logout).
5) Guard role untuk `/admin`, `/finance`, `/instructor`, `/user`.

Cookie tambahan yang dibuat middleware:
- `ppic_device_id` (httpOnly) → dipakai untuk korelasi audit log.

## C) RBAC untuk API

File: `src/lib/rbac.ts`

Helper:
- `requireSession()` → memastikan login
- `requireRole([roles...])` → memastikan role sesuai

Pola umum di route handler:

```ts
const { session, response } = await requireRole(["ADMIN"]);
if (!session) return response;
// ...lanjut logic
```

Jika tidak login → 401.
Jika role tidak sesuai → 403.

Implementasi ada di `src/lib/rbac.ts`:
- `requireSession()` mengembalikan `{ ok:false }` lewat `jsonError("Unauthorized", 401)`
- `requireRole([...])` mengembalikan `jsonError("Forbidden", 403)` bila role tidak match

## D) Login

Endpoint:
- `POST /api/auth/login`

File: `src/app/api/auth/login/route.ts`

Ringkasan alur:
1) Validasi input (Zod): `identifier` dan `password`.
2) Cari user berdasarkan:
   - username
   - email
   - email di profile
3) Verifikasi password (bcrypt).
4) Update `lastLoginAt`, `lastLoginIp`, `lastLoginUserAgent` (best-effort).
5) Tulis audit log `auth.login` (best-effort) termasuk `ip`, `userAgent`, `deviceId`.
6) Sign JWT + set cookie session.

### Request body

```json
{
  "identifier": "admin",
  "password": "admin123"
}
```

`identifier` dapat berupa:
- `username` (contoh: `admin`)
- `email` (dicari di `User.email` maupun `Profile.email`, normalisasi lowercase jika mengandung `@`)

### Response (sukses)

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "...",
      "username": "admin",
      "role": "ADMIN",
      "emailVerified": true
    }
  }
}
```

### Response (gagal)

- Salah credential → 401 `Username/Email atau password salah`
- Input tidak valid (Zod) → 400 `Input tidak valid` + `details`

## E) Logout

Umumnya dilakukan dengan menghapus cookie `ppic_session`.
Lihat endpoint logout di `src/app/api/auth/logout/route.ts`.

## F) Registrasi

Endpoint:
- `POST /api/auth/register`

Umumnya membuat user role `USER`, menyimpan `passwordHash`, lalu mengarahkan user untuk melengkapi profil/dokumen.

### Request body

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

Catatan:
- `username` harus 3–32 char dan hanya `[a-zA-Z0-9_]`.
- Email dinormalisasi ke lowercase.

### Behavior penting

- Jika username/email sudah dipakai → 409.
- Setelah berhasil register, server langsung membuat session (`ppic_session`) dengan `emailVerified=false`.
- Sistem mencoba mengirim OTP verifikasi email secara best-effort (gagal kirim tidak membatalkan registrasi).

## G) Verifikasi Email (OTP)

Konsep:
- OTP 6 digit.
- TTL 10 menit.
- Maks percobaan 3.
- Cooldown request OTP 60 detik.

File OTP core:
- `src/lib/emailVerification.ts`

Secret hashing OTP:
- `OTP_SECRET` (jika ada)
- fallback: `JWT_SECRET`
- fallback terakhir (dev): string default

Endpoint:
- `POST /api/auth/otp/request` → minta OTP
- `POST /api/auth/otp/verify` → verifikasi OTP

### 1) Request OTP

Tidak butuh body. Harus login.

Response sukses (contoh):

```json
{ "ok": true, "data": { "expiresAt": "2026-...", "delivery": "..." } }
```

### 2) Verify OTP

Request body:

```json
{ "code": "123456" }
```

Behavior:
- Jika sukses, server refresh JWT session agar `emailVerified=true`.
- Audit log best-effort: `auth.email_verified`.
- Welcome email best-effort.

Middleware memaksa user yang `emailVerified=false` untuk menyelesaikan ini sebelum akses fitur lain.

## H) Reset Password

Terdapat 2 mekanisme yang dipakai:

### 1) Reset password via token link

File:
- `src/lib/passwordReset.ts`

Env:
- `APP_URL` dipakai untuk base URL link reset.

Alur:
1) User meminta reset.
2) Sistem membuat token random, simpan hash di DB dengan TTL.
3) Kirim link `/reset-password?token=...`.
4) Token dikonsumsi sekali.

### 2) Reset password via OTP

File:
- `src/lib/passwordResetOtp.ts`

Konsep mirip verifikasi email OTP (secret bisa `OTP_SECRET`).

### Endpoint yang dipakai UI (OTP-based)

Flow reset password yang aktif di repo ini menggunakan 3 endpoint:

1) `POST /api/auth/password-reset/request`
- Body: `{ "email": "user@example.com" }`
- Selalu return `ok` untuk mencegah email enumeration (baik email ada atau tidak).

2) `POST /api/auth/password-reset/verify-otp`
- Body: `{ "email": "user@example.com", "code": "123456" }`
- Jika OTP valid, server membuat cookie httpOnly jangka pendek: `ppic_pwreset` (15 menit)

3) `POST /api/auth/password-reset/confirm`
- Body: `{ "newPassword": "secret123" }`
- Token reset diambil dari body `token` (opsional) atau dari cookie `ppic_pwreset`
- Jika sukses, password user di-update dan cookie reset di-clear

Catatan:
- Setelah reset sukses, audit log best-effort: `auth.password_reset`.

## I) Device ID untuk Audit Log

Karena web app tidak dapat mengambil MAC address client secara realistis, project ini memakai pendekatan **Device ID**:

- Middleware memastikan cookie `ppic_device_id` selalu ada.
- Audit log menyimpan `deviceId` ke `metadata.deviceId`.

File:
- `src/middleware.ts` (set cookie)
- `src/lib/audit.ts` (ambil deviceId dari header/cookie)
- `src/lib/audit.ts` + `src/lib/audit.ts` (write log)

Catatan:
- Device ID bukan identitas perangkat yang “pasti”, tetapi cukup untuk korelasi aktivitas pada browser/perangkat tertentu.

## J) Detail: Sumber `emailVerified`

Di database, status verifikasi email disimpan sebagai:
- `User.emailVerifiedAt` (DateTime | null)

Saat login (`POST /api/auth/login`), aplikasi menghitung:
- `emailVerified = Boolean(emailVerifiedAt)`

Nilai `emailVerified` ini dimasukkan ke JWT session payload.

Di `src/lib/session.ts` ada kompatibilitas:
- Token yang diterbitkan sebelum field `emailVerified` ada akan dianggap `true`.

## K) Catatan Penting: `JWT_SECRET` wajib di Production

Middleware akan mencoba memverifikasi cookie session memakai `JWT_SECRET`.
Jika `JWT_SECRET` tidak diset, middleware saat ini melakukan *best-effort* dan membiarkan request lewat.

Implikasi:
- Di production, **wajib** set `JWT_SECRET` agar guard bekerja benar.

Rekomendasi:
- Set `JWT_SECRET` panjang dan random.
- Pastikan nilai sama pada semua instance (jika deploy multi-replica).

## L) Mengakses Session di Server Component

Contoh penggunaan session di layout:
- `src/app/layout.tsx` memanggil `getSessionFromCookies()` lalu meneruskan data ke `HeaderNav`.

Pola ini penting karena:
- `layout.tsx` adalah server component, sehingga bisa membaca cookie `httpOnly`.
- Komponen client (mis. `HeaderNav.tsx`) menerima session sebagai props untuk render UI.

---

# 04 — Database & Prisma (MongoDB)

Dokumen ini menjelaskan **seluruh hal terkait database** di repo ini: konfigurasi MongoDB, Prisma schema, cara apply perubahan schema, seed, indexing, serta catatan “legacy” SQLite (untuk migrasi data lama).

---

## A) Lokasi “Kode Database” di Repo

**Schema & Prisma**
- `prisma/schema.prisma` → schema utama (provider **mongodb**)
- `prisma/seed.ts` → seed data (akun awal + data pendukung)
- `src/lib/prisma.ts` → singleton `PrismaClient` (aman untuk Next.js dev hot-reload)

**Konfigurasi env**
- `.env` (tidak di-commit)
- `.env.example` → template variabel env, termasuk `DATABASE_URL`

**Query DB (CRUD) di aplikasi**
- `src/app/api/**/route.ts` → API routes (route handlers) yang melakukan query
- `src/lib/**` → helper server yang juga query DB (settings, audit, reminders, auth flow, dll)

**Script util DB (opsional)**
- `scripts/fix-mongo-sparse-unique-indexes.ts` → perbaiki index unik opsional agar *sparse*
- `scripts/migrate-sqlite-to-mongo.ts` → migrasi data dari SQLite (legacy) ke Mongo

---

## B) MongoDB: Konfigurasi Koneksi

Project ini menggunakan Prisma dengan datasource:

```prisma
datasource db {
	provider = "mongodb"
	url      = env("DATABASE_URL")
}
```

Artinya **MongoDB ditentukan oleh** env var `DATABASE_URL`.

### 1) Isi `.env`

Gunakan `.env.example` sebagai acuan, minimal:

```bash
DATABASE_URL="mongodb+srv://..."
JWT_SECRET="..."
```

Contoh koneksi **MongoDB Atlas** (umum):

```bash
DATABASE_URL="mongodb+srv://<user>:<password>@<cluster-host>/<db>?retryWrites=true&w=majority"
```

Contoh koneksi **Mongo lokal**:

```bash
DATABASE_URL="mongodb://localhost:27017/ppic"
```

Catatan:
- Nama database ada di bagian path, misalnya `/ppic`.
- Pastikan user/password & network allowlist Atlas sudah benar.

---

## C) Prisma Workflow yang Dipakai Project

### 1) Generate Prisma Client

Biasanya otomatis setelah `npm install` (ada script `postinstall`), tapi bisa manual:

```bash
npm run prisma:generate
```

### 2) Apply perubahan schema ke MongoDB

Project ini memakai:

```bash
npm run prisma:migrate
```

Script tersebut menjalankan `prisma db push`.

Kenapa `db push`?
- Pada Prisma + MongoDB, pendekatannya **menyinkronkan schema** (bukan migrasi SQL berurutan).

### 3) Reset DB (hapus semua data)

```bash
npm run db:reset
```

Ini menjalankan `prisma db push --force-reset` (berbahaya untuk production).

### 4) Prisma Studio

Untuk inspeksi data:

```bash
npm run prisma:studio
```

---

## D) Prisma Client di Kode Aplikasi

Singleton Prisma client ada di `src/lib/prisma.ts`:

- Di server-side code, import seperti ini:

```ts
import { prisma } from "@/lib/prisma";
```

Tujuannya:
- Menghindari membuat banyak koneksi ketika Next dev hot-reload.
- Memusatkan cara membuat client.

Catatan penggunaan:
- Pakai `prisma` hanya di **server** (route handlers, server actions, lib server).
- Hindari import Prisma client ke komponen client (`"use client"`).

---

## E) Seed Data (Akun & Data Awal)

Jalankan seed:

```bash
npm run db:seed
```

Seed file ada di `prisma/seed.ts` dan umumnya membuat:
- System accounts (login by **username**):
	- `admin / admin123`
	- `finance / finance123`
	- `instructor / instructor123`
- Profile untuk akun system agar statusnya `APPROVED`

Tambahan:
- `.env.example` menyediakan env optional `SEED_*` untuk membuat akun tambahan (berbasis email+password) bila diaktifkan (lihat implementasi di `prisma/seed.ts`).

---

## F) Model Data: Gambaran & Pemetaan

Sumber kebenaran model ada di `prisma/schema.prisma`.

Ringkasannya:

### 1) User

- Identitas login: `username` (unik), `passwordHash`, `role`
- Email opsional: `email` + `emailVerifiedAt`
- Telemetri login: `lastLoginAt`, `lastLoginIp`, `lastLoginUserAgent`

### 2) Profile, Document

- `Profile` menyimpan biodata dan status verifikasi (`PENDING/APPROVED/REJECTED`).
- `Document` menyimpan dokumen user (tipe: `LICENSE/MEDICAL/ID/...`) dan status verifikasi.

### 3) Booking, ScheduleSlot

- `Booking` adalah pemesanan simulator (state di `BookingStatus`).
- `ScheduleSlot` adalah slot jadwal (state di `SlotStatus`).

### 4) Payment, LegalDocument

- `Payment` untuk pembayaran (state di `PaymentStatus`).
- `LegalDocument` untuk dokumen legal (mis. `PKS`, `BERITA_ACARA`).

### 5) AuditLog, Notification

- `AuditLog` untuk jejak aktivitas (aktor, action, target, metadata, ip, userAgent).
- `Notification` untuk notifikasi per user (`readAt` menandai sudah dibaca).

---

## G) Catatan Penting: Unique Index untuk Field Opsional (MongoDB)

### Masalahnya

Di MongoDB, Prisma kadang membuat **unique index yang tidak sparse** untuk field `String? @unique`.
Akibatnya, banyak dokumen dengan nilai `null` pada field tersebut bisa dianggap melanggar unique index.

Di schema repo ini ada contoh field opsional unik:
- `User.email String? @unique`
- `ScheduleSlot.bookingId String? @unique`

Gejala umumnya:
- Error Prisma `P2002` (Unique constraint failed) saat insert/update.
- Terjadi walau field yang unik sebenarnya `null`/kosong.

### Solusi di repo ini

Repo menyediakan script untuk mengubah index tersebut menjadi **sparse unique**:

```bash
npm run db:fix-mongo-indexes
```

Script ini akan (re)create index:
- `User_email_key` menjadi `unique + sparse`
- `ScheduleSlot_bookingId_key` menjadi `unique + sparse`

Kapan dijalankan?
- Setelah `prisma db push` pertama kali
- Setelah perubahan schema yang menyentuh field optional unik
- Saat kamu menemukan konflik unique dengan nilai `null`

Alternatif lain (jika desain memungkinkan):
- Ubah field menjadi required (hapus `?`) sehingga unique-nya memang harus selalu diisi.

---

## H) Legacy: SQLite & Folder `prisma/migrations/`

Kamu akan menemukan folder:
- `prisma/migrations/**/migration.sql`

Ini **bukan workflow utama** database saat ini. Folder tersebut adalah sisa/jejak dari fase lama saat project menggunakan **SQLite** (atau untuk kebutuhan migrasi data lama).

Jika kamu sedang migrasi dari data SQLite lama:

1) Siapkan env:

```bash
SQLITE_DATABASE_URL="file:./dev.db"
DATABASE_URL="mongodb://..."
```

2) Generate Prisma client untuk schema SQLite:

```bash
npm run prisma:generate:sqlite
```

3) Jalankan migrasi data:

```bash
npm run db:migrate:sqlite-to-mongo
```

Catatan:
- Migrasi dilakukan bertahap (batch) dan memakai fallback insert per-row jika `createMany` gagal.
- Beberapa field string kosong akan dinormalisasi (contoh: `email`, `bookingId`) supaya tidak memicu unique index.

---

## I) Script Util DB yang Sering Dipakai

Semua perintah ini ada di `package.json`:

- Apply schema: `npm run prisma:migrate`
- Seed: `npm run db:seed`
- Reset database: `npm run db:reset`
- Fix index Mongo: `npm run db:fix-mongo-indexes`
- Migrasi legacy: `npm run db:migrate:sqlite-to-mongo`
- Util jadwal/booking (debug/ops):
	- `npm run db:clear-slots`
	- `npm run db:check-conflicts`
	- `npm run db:inspect-simulator`
	- `npm run db:split-wet-sessions`

---

## J) Troubleshooting

### 1) Prisma error EPERM di Windows

Jika ada error rename DLL engine Prisma:
- Stop semua proses `next dev`/`node`
- Jalankan ulang:

```bash
npm run prisma:generate
```

### 2) Error unique index padahal nilai `null`

Jalankan:

```bash
npm run db:fix-mongo-indexes
```

### 3) Tidak bisa connect ke MongoDB

Cek hal-hal ini:
- `DATABASE_URL` sudah benar (user/password, host, db name)
- Atlas: IP allowlist & user permission
- Lokal: service mongod aktif + port benar

---

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

---

# 06 — Panduan Penggunaan (End User)

Dokumen ini berfokus ke cara memakai aplikasi dari sisi pengguna (UI).

Catatan:
- Banyak alur UI berkaitan langsung dengan status booking/pembayaran.
- Middleware akan memaksa user yang belum verifikasi email untuk menyelesaikan OTP di `/verify-email`.

## A) Alur Utama User (ROLE: USER)

### 1) Registrasi

1. Buka `/register`.
2. Isi username + password (dan email jika diminta).
3. Setelah sukses, login lewat `/login`.

### 2) Verifikasi Email (OTP)

Jika setelah login diarahkan ke `/verify-email`:
1. Pastikan email sudah diisi (di profil).
2. Klik **Kirim OTP**.
3. Masukkan kode OTP yang diterima.

Catatan dev:
- Jika SMTP tidak dikonfigurasi, OTP akan muncul di console server.

Catatan implementasi:
- Setelah OTP terverifikasi, session token akan diperbarui sehingga `emailVerified=true`.

### 3) Lengkapi Profil

Halaman:
- `/user/profile` (atau `/account/profile`)

Isi:
- biodata dasar
- email, alamat, dll

### 4) Upload Dokumen

Halaman:
- `/user/documents`

Upload dokumen sesuai tipe:
- LICENSE
- MEDICAL
- ID
- dll

Dokumen akan berstatus:
- PENDING → menunggu verifikasi

Catatan format file:
- `PHOTO` harus JPG/PNG.
- Dokumen selain `PHOTO` harus PDF.

### 5) Buat Booking

Halaman:
- `/user/booking/new`

Langkah:
1. Pilih simulator (Airbus/Boeing) dan training.
2. Pilih skema lease (WET/DRY).
3. Simpan → booking akan dibuat dengan status awal `DRAFT`.

Catatan penting (sesuai validasi API):
- Untuk `WET`, `personCount` wajib 1 atau 2, dan jadwal (requestedStartAt/requestedEndAt) wajib.
- Untuk `DRY`, sistem akan menormalisasi training menjadi label `Dry Leased (<deviceType>)`.

### 6) Submit Booking

Dari detail booking (`/user/bookings/[id]`):
1. Klik submit.
2. Status berubah menjadi `WAIT_ADMIN_VERIFICATION`.
3. Sistem akan membuat notifikasi + (opsional) email.

Catatan:
- Untuk lease `WET`, dokumen wajib biasanya harus lengkap (LICENSE, MEDICAL, ID) kecuali email user masuk allowlist `DOCS_BYPASS_EMAILS`.

Jika submit berhasil:
- Status booking berubah dari `DRAFT` → `WAIT_ADMIN_VERIFICATION`.
- Sistem akan membuat notifikasi (best-effort) dan mengirim email (best-effort).

### 7) Menunggu Verifikasi Admin

Admin memverifikasi profil/dokumen dan menyetujui booking.

### 8) Menunggu Dokumen Finance

Setelah admin approve, status biasanya berpindah ke tahap finance.
Finance menerbitkan dokumen legal / instruksi pembayaran.

### 9) Upload Bukti Pembayaran

User mengunggah bukti pembayaran lewat fitur pembayaran (biasanya dari detail booking atau menu pembayaran).

### 10) Validasi Pembayaran

Finance memvalidasi:
- Jika VALIDATED → lanjut penjadwalan/konfirmasi.
- Jika REJECTED → user diminta upload ulang bukti bayar.

### 11) Pilih Slot Jadwal

Jika booking sudah masuk tahap penjadwalan:
1. User memilih slot yang tersedia.
2. Status slot berubah menjadi `BOOKED`.

Syarat penting:
- Pembayaran harus berstatus `VALIDATED` sebelum memilih slot.

Catatan WET:
- Slot WET harus jatuh ke sesi tetap (mis. sesi pagi/siang). Jika slot bukan sesi yang valid, sistem akan menolak.

### 12) Sertifikat

Jika booking selesai dan admin menerbitkan sertifikat:
- User bisa membuka `/user/certificates/[id]`.
- Sertifikat biasanya berisi QR code untuk validasi.

## B) Alur Admin (ROLE: ADMIN)

Halaman utama:
- `/admin/dashboard`

Aktivitas umum:
1. Verifikasi profil user: `/admin/verifications`
2. Verifikasi dokumen user: `/admin/verifications`
3. Kelola booking: `/admin/bookings`
  - approve booking
  - terbitkan sertifikat
4. Kelola slot jadwal: `/admin/schedule`
5. Kelola user: `/admin/users`
6. Audit logs: `/admin/logs`
  - lihat aktivitas (IP, user-agent, deviceId)
  - export CSV
7. Kelola landing/home: `/admin/landing`

Tips:
- Saat verifikasi dokumen, staff bisa download file user lewat endpoint download dokumen.
- Jika ada masalah unique index email opsional di Mongo, jalankan `npm run db:fix-mongo-indexes`.

## C) Alur Finance (ROLE: FINANCE)

Halaman utama:
- `/finance/dashboard`

Aktivitas umum:
1. Lihat pending booking: (sesuai menu finance)
2. Terbitkan dokumen legal:
  - `/finance/legal`
  - upload/preview/download dokumen
3. Kelola pembayaran:
  - `/finance/payments`
  - lihat bukti bayar
  - validasi / reject
4. Export report:
  - `/finance/dashboard/report`

Catatan:
- Setelah payment berstatus `VALIDATED`, user bisa memilih slot jadwal.

## D) Alur Instructor (ROLE: INSTRUCTOR)

Halaman utama:
- `/instructor/dashboard`

Aktivitas umum:
1. Jadwal: `/instructor/schedule`
2. Isi logbook untuk wet leased: `/instructor/logbook`
3. Akses data user tertentu (jika ada): `/instructor/users`

## E) Notifikasi

Widget notifikasi:
- `src/app/NotificationsWidget.tsx`

API:
- `GET /api/notifications`
- `POST /api/notifications/[id]/read`

Notifikasi dibuat pada event tertentu (contoh submit booking).

## F) Tips Pemakaian

- Jika icon/tab browser belum berubah, lakukan hard refresh atau buka incognito (favicon sering cache).
- Jika file upload gagal, cek permission folder `uploads/` (atau `UPLOAD_DIR`) dan pastikan server dapat menulis file.

Tambahan tips:
- Jika user selalu diarahkan ke `/verify-email`, pastikan OTP sudah diverifikasi (atau cek `User.emailVerifiedAt` di DB via Prisma Studio).
- Jika endpoint schedule/slot terasa “kosong”, cek parameter tanggal di schedule preview (public slots default 7 hari ke depan).

---

# 07 — Operasional (Uploads, SMTP, Cron, Branding)

## A) Uploads (File Storage)

Project menyimpan file upload ke disk (bukan ke database).

Env:
- `UPLOAD_DIR` (default: `uploads`)

Pola implementasi:
- API menerima `multipart/form-data`
- File disimpan sebagai `uploads/<generated-name>`
- Database menyimpan metadata (mimeType, fileName, storagePath)

Catatan implementasi:
- Path penyimpanan relatif disimpan di DB (contoh: `uploads/1712_abcd1234.pdf`).
- Aplikasi membaca file dengan `process.cwd()` + `storagePath` saat download.

Endpoint terkait (contoh):
- `POST /api/documents/upload`
- `GET /api/documents/[id]/download`
- `POST /api/finance/legal-documents/[id]/upload`
- `GET /api/finance/legal-documents/[id]/download`

### Landing images (opsional)

Landing images disajikan melalui endpoint public:
- `GET /api/public/landing-images/[name]`

Lokasi file yang dibaca endpoint tersebut:
- `<UPLOAD_DIR>/landing/<name>`

Catatan cache:
- Response landing-images diberi `Cache-Control: public, max-age=31536000, immutable`.

Catatan production:
- Pastikan folder upload berada di volume persistent.
- Pastikan permission write sesuai.
- Jika deploy multi-instance, pastikan storage dibagi (shared volume/object storage) atau desain upload disesuaikan.

## B) SMTP / Email Delivery

File:
- `src/lib/mailer.ts`

Mode:
- `MAIL_TRANSPORT=smtp` (default)
- `MAIL_TRANSPORT=ethereal` (hanya non-production)
- `MAIL_TRANSPORT=log` (selalu log, tidak mengirim)

Konfigurasi minimum SMTP:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_FROM`

Jika butuh auth:
- `SMTP_USER`
- `SMTP_PASS`

Base URL untuk link email:
- `APP_URL` (reset password link)
- `APP_BASE_URL` (CTA di template email)

Checklist SMTP (umum):
- Pastikan `SMTP_FROM` domain/address sesuai kebijakan provider.
- Untuk Gmail: gunakan App Password (bukan password akun biasa).

## C) Cron Reminders

Endpoint:
- `/api/public/cron/reminders/run`

Env:
- `REMINDER_CRON_SECRET`

Behavior:
- Jika `REMINDER_CRON_SECRET` kosong (dev) → endpoint bisa dipanggil tanpa auth.
- Jika production dan secret tidak ada → endpoint menolak dan mengembalikan error 500 (server not configured).

Cara memanggil:

```bash
curl -H "x-cron-secret: <secret>" "https://<host>/api/public/cron/reminders/run?dryRun=1&limit=10"
```

Header alternatif:

```bash
curl -H "Authorization: Bearer <secret>" "https://<host>/api/public/cron/reminders/run"
```

Catatan hasil:
- Endpoint mengembalikan statistik scanned/candidates/sent/skipped + daftar error (jika ada).

## D) Device ID & Audit Log

Cookie device id:
- `ppic_device_id` (httpOnly)

Dibuat di middleware (`src/middleware.ts`) agar setiap browser/perangkat punya id stabil.
Audit log akan merge `deviceId` ke `metadata.deviceId` saat menulis log (`src/lib/audit.ts`).

Tujuan:
- Mempermudah korelasi aktivitas tanpa mengandalkan identitas perangkat yang “asli”.

## E) Branding Assets (Logo & Icon Tab)

Logo header saat ini:
- `public/logoppic/logoppic.7a5aa04c.png`

Icon/tab (App Router):
- `src/app/icon.png` → otomatis menjadi `/icon.png`

Catatan:
- Browser sangat agresif cache favicon/icon. Jika terasa belum berubah, hard refresh atau incognito.

## F) UI Theme Ringkas

- Brand color utama: `#05164d`
- Global “square corners” ada di `src/app/globals.css` dengan pengecualian untuk avatar (`data-keep-rounded="true"`).

---

## H) Checklist Deploy (Minimum)

Sebelum production, pastikan:
- `DATABASE_URL` mengarah ke cluster/DB production
- `JWT_SECRET` diset dan sama untuk semua instance
- `REMINDER_CRON_SECRET` diset jika cron endpoint akan dipakai
- `UPLOAD_DIR` berada di storage yang persistent
- SMTP sudah diverifikasi (atau `MAIL_TRANSPORT` disetel sesuai kebutuhan)

## G) Scripts Operasional

Lihat `package.json` untuk script database dan maintenance:
- `npm run db:fix-mongo-indexes`
- `npm run db:clear-slots`
- `npm run db:check-conflicts`
- dst.
