import "dotenv/config";

import { PrismaClient } from "@prisma/client";

function hasArg(name: string) {
  return process.argv.slice(2).includes(name);
}

async function main() {
  const force = hasArg("--force") || hasArg("--all");

  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    const totalSlots = await prisma.scheduleSlot.count();
    const bookedSlots = await prisma.scheduleSlot.count({ where: { bookingId: { not: null } } });

    console.log(`[slots] total=${totalSlots} booked=${bookedSlots}`);

    if (!force && bookedSlots > 0) {
      console.error(
        `[slots] REFUSE: ada ${bookedSlots} slot yang sudah BOOKED/terkait booking. Jalankan dengan --force jika memang mau hapus semua.`
      );
      process.exitCode = 2;
      return;
    }

    const deleteWhere = force ? {} : { bookingId: null };

    // Clear pointers that may reference slot IDs.
    const bookingsUpdated = await prisma.booking.updateMany({
      where: { preferredSlotId: { not: null } },
      data: { preferredSlotId: null },
    });

    const deleted = await prisma.scheduleSlot.deleteMany({ where: deleteWhere as any });

    console.log(
      `[slots] deleted=${deleted.count} (force=${force}) | bookings.preferredSlotId cleared=${bookingsUpdated.count}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[slots] failed", e);
  process.exit(1);
});
