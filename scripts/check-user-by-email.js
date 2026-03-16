/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error("Usage: node scripts/check-user-by-email.js <email>");
    process.exit(1);
  }

  const email = String(emailArg).trim().toLowerCase();
  const prisma = new PrismaClient();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { email: emailArg }, { email: email.toLowerCase() }],
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      profile: { select: { email: true, fullName: true, status: true } },
    },
  });

  if (user) {
    console.log({ found: true, user });
    await prisma.$disconnect();
    return;
  }

  const byProfile = await prisma.profile.findFirst({
    where: { email: { not: null } },
    select: { userId: true, email: true },
  });

  // Best-effort: raw query for case-insensitive match in Profile.email
  const rows = await prisma.$queryRaw`SELECT u.id, u.username, u.email, u.role, p.email as profileEmail
    FROM "Profile" p
    JOIN "User" u ON u.id = p.userId
    WHERE p.email IS NOT NULL AND lower(p.email) = lower(${email})
    LIMIT 1`;

  console.log({ found: false, hint: "No user matched in User.email or Profile.email", sampleProfileRow: byProfile, rawMatch: rows });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
