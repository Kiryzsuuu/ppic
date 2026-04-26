# 🚀 PPIC - One Click Setup

Jalankan aplikasi PPIC dengan **satu klik**!

## Setup untuk Windows

### Cara Termudah (Double-Click):
1. Buka folder project PPIC
2. **Double-click** file `setup.bat`
3. Tunggu sampai selesai dan browser otomatis buka di `http://localhost:3000`

**Itu saja! 🎉**

---

## Setup untuk macOS / Linux

### Cara Termudah (Terminal):
```bash
chmod +x setup.sh
./setup.sh
```

Tunggu sampai selesai dan browser otomatis buka di `http://localhost:3000`

---

## Apa yang Dilakukan Script?

Script setup otomatis melakukan:

1. ✅ **Cek Node.js & npm** - Memastikan requirements ada
2. ✅ **Install Dependencies** - `npm install` (semua library)
3. ✅ **Generate Prisma Client** - Setup database driver
4. ✅ **Sync Database** - `prisma db push` (create/update tables)
5. ✅ **Jalankan Dev Server** - `npm run dev` (aplikasi berjalan)

---

## Troubleshooting

### Error: Node.js not found
- Install Node.js dari https://nodejs.org/ (LTS version)
- Restart komputer setelah install

### Error: npm install failed
- Cek internet connection
- Coba hapus `node_modules` folder dan `package-lock.json`
- Jalankan setup script lagi

### Error: Database connection
- Pastikan file `.env` sudah ada dengan `DATABASE_URL`
- Cek koneksi ke MongoDB

---

## Manual Setup (Jika Script Tidak Bekerja)

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Sync database
npx prisma db push

# Start development server
npm run dev
```

Browser otomatis buka di `http://localhost:3000`

---

## Selesai! 🎉

Aplikasi sudah running. Anda bisa:
- View aplikasi: `http://localhost:3000`
- Lihat logs di terminal
- Press `Ctrl+C` untuk stop server

Enjoy! 🚀
