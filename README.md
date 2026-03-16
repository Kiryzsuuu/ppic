# PPI Curug Simulator Training

Aplikasi web **Manajemen Penyewaan Simulator Pesawat** untuk **PPI Curug Simulator Training** dengan role:

- **User**: registrasi, upload dokumen, membuat booking, pembayaran, memilih slot jadwal, melihat sertifikat (QR)
- **Admin**: verifikasi profil/dokumen, approve booking, kelola slot jadwal, terbitkan sertifikat
- **Finance**: menerbitkan dokumen legal + VA, validasi pembayaran, upload/preview dokumen legal, preview bukti bayar
- **Instructor**: isi logbook untuk Wet Leased

Teknologi: **Next.js (App Router) + TypeScript + Tailwind + Prisma + MongoDB**.

## Lokasi Project

Project Next.js ada di folder:

`PPIC/ppi-curug-simulator-training`

## Setup (Development)

1) Install dependency

```bash
npm install
```

2) Siapkan env

- Copy `.env.example` → `.env` (jika belum ada)
- Pastikan minimal ada:
	- `DATABASE_URL="mongodb+srv://.../<db>?retryWrites=true&w=majority"`
	- `JWT_SECRET="..."`
	- (opsional) `UPLOAD_DIR="uploads"`

Untuk fitur verifikasi email OTP, isi juga konfigurasi SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, dst). Pada mode development, jika SMTP belum diisi, OTP akan ditampilkan di log server.

3) Inisialisasi database + seed

```bash
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

4) Jalankan dev server

```bash
npm run dev
```

Buka `http://localhost:3000`.

## Akun Seed (dev)

- `admin / admin123`
- `finance / finance123`
- `instructor / instructor123`

## Catatan Upload

File upload disimpan ke folder `uploads/` (default). Metadata disimpan di MongoDB.

## Logo Header

Header menggunakan logo dari `public/ppi-curug-logo.png`. Simpan file logo (PNG) ke path tersebut agar tampil di header.

## Melihat Database

Database default menggunakan MongoDB (lihat `DATABASE_URL` di `.env`).

Opsi cepat:

1) Prisma Studio

```bash
npx prisma studio
```

2) MongoDB Atlas UI

Gunakan halaman Atlas untuk melihat collections dan dokumen.

## Build

```bash
npm run build
npm start
```
