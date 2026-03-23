# 06 — Panduan Penggunaan (End User)

Dokumen ini berfokus ke cara memakai aplikasi dari sisi pengguna (UI).

## A) Alur Utama User (ROLE: USER)

### 1) Registrasi
1. Buka `/register`.
2. Isi username + password (dan email jika diminta).
3. Setelah sukses, login lewat `/login`.

### 2) Verifikasi Email (OTP)
Jika setelah login diarahkan ke `/verify-email`:
1. Pastikan email sudah diisi (di profil).
2. Klik **Kirim OTP**.
3. Masukkan kode OTP yang diterima.

Catatan dev:
- Jika SMTP tidak dikonfigurasi, OTP akan muncul di console server.

### 3) Lengkapi Profil
Halaman:
- `/user/profile` (atau `/account/profile`)

Isi:
- biodata dasar
- email, alamat, dll

### 4) Upload Dokumen
Halaman:
- `/user/documents`

Upload dokumen sesuai tipe:
- LICENSE
- MEDICAL
- ID
- dll

Dokumen akan berstatus:
- PENDING → menunggu verifikasi

### 5) Buat Booking
Halaman:
- `/user/booking/new`

Langkah:
1. Pilih simulator (Airbus/Boeing) dan training.
2. Pilih skema lease (WET/DRY).
3. Simpan → booking akan dibuat dengan status awal `DRAFT`.

### 6) Submit Booking
Dari detail booking (`/user/bookings/[id]`):
1. Klik submit.
2. Status berubah menjadi `WAIT_ADMIN_VERIFICATION`.
3. Sistem akan membuat notifikasi + (opsional) email.

Catatan:
- Untuk lease `WET`, dokumen wajib biasanya harus lengkap (LICENSE, MEDICAL, ID) kecuali email user masuk allowlist `DOCS_BYPASS_EMAILS`.

### 7) Menunggu Verifikasi Admin
Admin memverifikasi profil/dokumen dan menyetujui booking.

### 8) Menunggu Dokumen Finance
Setelah admin approve, status biasanya berpindah ke tahap finance.
Finance menerbitkan dokumen legal / instruksi pembayaran.

### 9) Upload Bukti Pembayaran
User mengunggah bukti pembayaran lewat fitur pembayaran (biasanya dari detail booking atau menu pembayaran).

### 10) Validasi Pembayaran
Finance memvalidasi:
- Jika VALIDATED → lanjut penjadwalan/konfirmasi.
- Jika REJECTED → user diminta upload ulang bukti bayar.

### 11) Pilih Slot Jadwal
Jika booking sudah masuk tahap penjadwalan:
1. User memilih slot yang tersedia.
2. Status slot berubah menjadi `BOOKED`.

### 12) Sertifikat
Jika booking selesai dan admin menerbitkan sertifikat:
- User bisa membuka `/user/certificates/[id]`.
- Sertifikat biasanya berisi QR code untuk validasi.

## B) Alur Admin (ROLE: ADMIN)

Halaman utama:
- `/admin/dashboard`

Aktivitas umum:
1. Verifikasi profil user: `/admin/verifications`
2. Verifikasi dokumen user: `/admin/verifications`
3. Kelola booking: `/admin/bookings`
   - approve booking
   - terbitkan sertifikat
4. Kelola slot jadwal: `/admin/schedule`
5. Kelola user: `/admin/users`
6. Audit logs: `/admin/logs`
   - lihat aktivitas (IP, user-agent, deviceId)
   - export CSV
7. Kelola landing/home: `/admin/landing`

## C) Alur Finance (ROLE: FINANCE)

Halaman utama:
- `/finance/dashboard`

Aktivitas umum:
1. Lihat pending booking: (sesuai menu finance)
2. Terbitkan dokumen legal:
   - `/finance/legal`
   - upload/preview/download dokumen
3. Kelola pembayaran:
   - `/finance/payments`
   - lihat bukti bayar
   - validasi / reject
4. Export report:
   - `/finance/dashboard/report`

## D) Alur Instructor (ROLE: INSTRUCTOR)

Halaman utama:
- `/instructor/dashboard`

Aktivitas umum:
1. Jadwal: `/instructor/schedule`
2. Isi logbook untuk wet leased: `/instructor/logbook`
3. Akses data user tertentu (jika ada): `/instructor/users`

## E) Notifikasi

Widget notifikasi:
- `src/app/NotificationsWidget.tsx`

API:
- `GET /api/notifications`
- `POST /api/notifications/[id]/read`

Notifikasi dibuat pada event tertentu (contoh submit booking).

## F) Tips Pemakaian

- Jika icon/tab browser belum berubah, lakukan hard refresh atau buka incognito (favicon sering cache).
- Jika file upload gagal, cek permission folder `uploads/` (atau `UPLOAD_DIR`) dan pastikan server dapat menulis file.
