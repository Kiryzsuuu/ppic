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
