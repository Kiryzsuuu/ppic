# 01 — Quickstart & Setup Lokal

## 1) Prasyarat

- Node.js (LTS disarankan)
- NPM
- Akses database MongoDB (contoh: MongoDB Atlas)

## 2) Install Dependency

Di root project `ppi-curug-simulator-training`:

```bash
npm install
```

Catatan: repo memiliki script `postinstall` yang otomatis menjalankan `prisma generate`.

## 3) Konfigurasi Environment

Buat file `.env` di root project. Template ada di `.env.example`.

Minimal yang wajib:

- `DATABASE_URL`
- `JWT_SECRET`

Opsional (tapi direkomendasikan):

- `UPLOAD_DIR` (default `uploads`)
- `APP_URL` (dibutuhkan untuk link reset password)
- `APP_BASE_URL` (dibutuhkan untuk tombol CTA di email template)

Untuk email/OTP (production disarankan pakai SMTP):

- `MAIL_TRANSPORT` = `smtp` | `ethereal` | `log`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`
- `SMTP_USER`, `SMTP_PASS` (jika SMTP butuh auth)

## 4) Inisialisasi Database (Prisma)

Project ini pakai Prisma dengan provider **MongoDB**.

Perintah penting:

```bash
npm run prisma:migrate
npm run db:seed
```

Penjelasan:
- `prisma:migrate` menjalankan `prisma db push` (meng-apply schema ke MongoDB).
- `db:seed` menjalankan `prisma/seed.ts` untuk membuat akun seed + data awal.

Jika perlu generate client manual:

```bash
npm run prisma:generate
```

## 5) Jalankan Development Server

```bash
npm run dev
```

Buka:
- http://localhost:3000

## 6) Akun Seed (Development)

Secara default (hasil seed):
- `admin / admin123`
- `finance / finance123`
- `instructor / instructor123`

Role `USER` dibuat via registrasi.

## 7) Build & Run Production

Build:

```bash
npm run build
```

Run:

```bash
npm start
```

## 8) Troubleshooting Cepat

### Prisma error EPERM di Windows
Jika muncul error semacam:
`EPERM: operation not permitted, rename ... query_engine-windows.dll.node.tmp`

Biasanya ada proses `node.exe` yang masih mengunci file engine Prisma.
Solusi:
1) Stop semua proses `npm run dev`/`next dev`.
2) Pastikan tidak ada node yang masih running.
3) Jalankan ulang:

```bash
npm run prisma:generate
```

### Email/OTP di dev tidak terkirim
Jika SMTP belum dikonfigurasi, sistem akan fallback ke **log** (console server) di mode non-production.
Lihat output terminal untuk kode OTP/link.
