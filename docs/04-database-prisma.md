# 04 — Database & Prisma (MongoDB)

## A) Prisma Overview

Folder:
- `prisma/schema.prisma` → schema utama (MongoDB)
- `prisma/seed.ts` → seed data

Client Prisma:
- `src/lib/prisma.ts` membuat singleton `PrismaClient` (aman untuk Next dev hot-reload).

## B) Menjalankan Perubahan Schema

Perintah yang dipakai project:

```bash
npm run prisma:migrate
```

Script tersebut menjalankan:
- `prisma db push`

Artinya:
- Prisma akan menyinkronkan schema ke MongoDB (tanpa migration file seperti SQL).

## C) Seed Data

Perintah:

```bash
npm run db:seed
```

Seed biasanya membuat:
- akun `admin`, `finance`, `instructor`
- setting awal yang diperlukan

## D) Model Penting

Berikut gambaran model inti (ringkas):

### 1) User
- Menyimpan `username`, `passwordHash`, `role`
- `emailVerifiedAt` untuk status verifikasi email
- `lastLoginAt`, `lastLoginIp`, `lastLoginUserAgent`

### 2) Profile
- Biodata user
- `registrationType`: personal / company
- `status`: `PENDING/APPROVED/REJECTED`
- relasi ke `Document[]`

### 3) Document
- File dokumen user: `LICENSE`, `MEDICAL`, `ID`, dll
- `storagePath` menunjuk file di disk (`UPLOAD_DIR`)
- status verifikasi

### 4) Booking
- Berisi pemesanan simulator
- memiliki `status` yang cukup panjang (lihat enum `BookingStatus`)

### 5) ScheduleSlot
- Slot jadwal simulator, status: `AVAILABLE/LOCKED/BOOKED`

### 6) Payment & LegalDocument
- Payment status: `UNPAID/PAID/VALIDATED/REJECTED`
- Dokumen legal: `PKS`, `BERITA_ACARA` dengan status `DRAFT/ISSUED`

### 7) Certificate
- Sertifikat booking yang bisa diakses dan memuat QR code

### 8) AuditLog
- Tabel log aktivitas
- Field: `action`, `targetType`, `targetId`, `metadata`, `ip`, `userAgent`, `createdAt`
- `metadata.deviceId` dipakai untuk korelasi perangkat

### 9) Notification
- Notifikasi per user
- `readAt` untuk status terbaca

## E) Enum Status (yang sering dipakai UI)

- `Role`: USER/ADMIN/FINANCE/INSTRUCTOR
- `VerificationStatus`: PENDING/APPROVED/REJECTED
- `BookingStatus`: DRAFT → WAIT_ADMIN_VERIFICATION → WAIT_FINANCE_DOCS → WAIT_PAYMENT → PAYMENT_VALIDATION → CONFIRMED → COMPLETED (dan CANCELLED)
- `PaymentStatus`: UNPAID/PAID/VALIDATED/REJECTED

## F) Prisma Studio

Untuk melihat data:

```bash
npm run prisma:studio
```

## G) Catatan MongoDB Unique Index & Sparse

Karena beberapa field email bersifat opsional, pastikan index unik tidak mengunci nilai `null` di banyak dokumen.
Project memiliki script helper:

```bash
npm run db:fix-mongo-indexes
```

Gunakan ini jika terjadi konflik unique index saat field opsional.
