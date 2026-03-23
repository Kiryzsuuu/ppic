# PPI Curug Simulator Training

Aplikasi web **Simulator Booking & Management System** untuk **PPI Curug Simulator Training**.

Role yang didukung:
- **USER**: registrasi, verifikasi email, kelola profil + dokumen, buat booking, pembayaran, pilih slot, sertifikat
- **ADMIN**: verifikasi profil/dokumen, approve booking, kelola slot, terbitkan sertifikat, audit logs, landing config
- **FINANCE**: dokumen legal, validasi pembayaran, report
- **INSTRUCTOR**: logbook (wet leased) dan jadwal

Stack: **Next.js (App Router) + TypeScript + Tailwind + Prisma + MongoDB**.

## Dokumentasi Lengkap

Dokumentasi dari nol ada di folder `docs/`:
- `docs/README.md` (index)
- `docs/02-routing.md` (routing App Router + middleware)
- `docs/05-api-reference.md` (API reference)
- `docs/06-usage-guide.md` (panduan penggunaan)

## Quickstart (Local Dev)

1) Install

```bash
npm install
```

2) Siapkan env

- Copy `.env.example` → `.env`
- Isi minimal:
  - `DATABASE_URL`
  - `JWT_SECRET`

3) Apply schema + seed

```bash
npm run prisma:migrate
npm run db:seed
```

4) Run

```bash
npm run dev
```

Buka `http://localhost:3000`.

## Akun Seed (Dev)

- `admin / admin123`
- `finance / finance123`
- `instructor / instructor123`

## Build (Production)

```bash
npm run build
npm start
```
