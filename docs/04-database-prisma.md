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

