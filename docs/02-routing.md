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
