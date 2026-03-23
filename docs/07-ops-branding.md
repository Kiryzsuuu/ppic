# 07 — Operasional (Uploads, SMTP, Cron, Branding)

## A) Uploads (File Storage)

Project menyimpan file upload ke disk (bukan ke database).

Env:
- `UPLOAD_DIR` (default: `uploads`)

Pola implementasi:
- API menerima `multipart/form-data`
- File disimpan sebagai `uploads/<generated-name>`
- Database menyimpan metadata (mimeType, fileName, storagePath)

Endpoint terkait (contoh):
- `POST /api/documents/upload`
- `GET /api/documents/[id]/download`
- `POST /api/finance/legal-documents/[id]/upload`
- `GET /api/finance/legal-documents/[id]/download`

Catatan production:
- Pastikan folder upload berada di volume persistent.
- Pastikan permission write sesuai.

## B) SMTP / Email Delivery

File:
- `src/lib/mailer.ts`

Mode:
- `MAIL_TRANSPORT=smtp` (default)
- `MAIL_TRANSPORT=ethereal` (hanya non-production)
- `MAIL_TRANSPORT=log` (selalu log, tidak mengirim)

Konfigurasi minimum SMTP:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_FROM`

Jika butuh auth:
- `SMTP_USER`
- `SMTP_PASS`

Base URL untuk link email:
- `APP_URL` (reset password link)
- `APP_BASE_URL` (CTA di template email)

## C) Cron Reminders

Endpoint:
- `/api/public/cron/reminders/run`

Env:
- `REMINDER_CRON_SECRET`

Behavior:
- Jika `REMINDER_CRON_SECRET` kosong (dev) → endpoint bisa dipanggil tanpa auth.
- Jika production dan secret tidak ada → endpoint menolak dan mengembalikan error 500 (server not configured).

Cara memanggil:

```bash
curl -H "x-cron-secret: <secret>" "https://<host>/api/public/cron/reminders/run?dryRun=1&limit=10"
```

## D) Device ID & Audit Log

Cookie device id:
- `ppic_device_id` (httpOnly)

Dibuat di middleware (`src/middleware.ts`) agar setiap browser/perangkat punya id stabil.
Audit log akan merge `deviceId` ke `metadata.deviceId` saat menulis log (`src/lib/audit.ts`).

## E) Branding Assets (Logo & Icon Tab)

Logo header saat ini:
- `public/logoppic/logoppic.7a5aa04c.png`

Icon/tab (App Router):
- `src/app/icon.png` → otomatis menjadi `/icon.png`

Catatan:
- Browser sangat agresif cache favicon/icon. Jika terasa belum berubah, hard refresh atau incognito.

## F) UI Theme Ringkas

- Brand color utama: `#05164d`
- Global “square corners” ada di `src/app/globals.css` dengan pengecualian untuk avatar (`data-keep-rounded="true"`).

## G) Scripts Operasional

Lihat `package.json` untuk script database dan maintenance:
- `npm run db:fix-mongo-indexes`
- `npm run db:clear-slots`
- `npm run db:check-conflicts`
- dst.
