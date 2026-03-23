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
