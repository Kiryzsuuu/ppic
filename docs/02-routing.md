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

### Cookie yang relevan
- `ppic_session` → JWT session (httpOnly)
- `ppic_device_id` → device id (httpOnly) untuk audit log / pelacakan perangkat

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
