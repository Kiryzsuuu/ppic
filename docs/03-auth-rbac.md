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

## B) Middleware Guard

File: `src/middleware.ts`

Yang dilakukan middleware:
1) Mengecualikan route public + static assets.
2) Jika route protected dan tidak ada cookie `ppic_session` → redirect ke `/login?next=...`.
3) Jika ada token dan `JWT_SECRET` tersedia → verifikasi token.
4) Jika `emailVerified=false` → paksa redirect ke `/verify-email` (kecuali endpoint OTP dan logout).
5) Guard role untuk `/admin`, `/finance`, `/instructor`, `/user`.

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

## E) Logout

Umumnya dilakukan dengan menghapus cookie `ppic_session`.
Lihat endpoint logout di `src/app/api/auth/logout/route.ts`.

## F) Registrasi

Endpoint:
- `POST /api/auth/register`

Umumnya membuat user role `USER`, menyimpan `passwordHash`, lalu mengarahkan user untuk melengkapi profil/dokumen.

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

## L) Mengakses Session di Server Component

Contoh penggunaan session di layout:
- `src/app/layout.tsx` memanggil `getSessionFromCookies()` lalu meneruskan data ke `HeaderNav`.

Pola ini penting karena:
- `layout.tsx` adalah server component, sehingga bisa membaca cookie `httpOnly`.
- Komponen client (mis. `HeaderNav.tsx`) menerima session sebagai props untuk render UI.
