import bcrypt from "bcryptjs";
import { PrismaClient, Role, RegistrationType, AircraftCategory } from "@prisma/client";

const prisma = new PrismaClient();

function toUsernameFromEmail(email: string) {
  const local = email.split("@")[0] || "user";
  const cleaned = local.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24);
  return cleaned.length >= 3 ? cleaned : `user_${cleaned}`;
}

async function ensureUniqueUsername(base: string) {
  let name = base;
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.user.findUnique({ where: { username: name } });
    if (!exists) return name;
    name = `${base}_${i + 1}`;
  }
  return `${base}_${Date.now()}`;
}

async function findUserIdByEmailInsensitive(email: string): Promise<string | null> {
  const e = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: e }, { profile: { is: { email: e } } }],
    },
    select: { id: true },
  });

  return user?.id ?? null;
}

async function upsertByEmail(opts: { email: string; password: string; role: Role; fullName: string }) {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  const normalizedEmail = opts.email.trim().toLowerCase();
  const existingId = await findUserIdByEmailInsensitive(normalizedEmail);
  const existing = existingId ? await prisma.user.findUnique({ where: { id: existingId } }) : null;

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: normalizedEmail,
        passwordHash,
        role: opts.role,
      },
    });

    await prisma.profile.upsert({
      where: { userId: existing.id },
      update: { fullName: opts.fullName, email: normalizedEmail, status: "APPROVED" },
      create: {
        userId: existing.id,
        registrationType: RegistrationType.PERSONAL,
        fullName: opts.fullName,
        email: normalizedEmail,
        status: "APPROVED",
      },
    });

    return updated;
  }

  const baseUsername = toUsernameFromEmail(opts.email);
  const username = await ensureUniqueUsername(baseUsername);

  return await prisma.user.create({
    data: {
      username,
      email: normalizedEmail,
      passwordHash,
      role: opts.role,
      profile: {
        create: {
          registrationType: RegistrationType.PERSONAL,
          fullName: opts.fullName,
          email: normalizedEmail,
          status: "APPROVED",
        },
      },
    },
  });
}

async function ensureUniqueSystemEmail(opts: {
  username: string;
  currentUserId: string | null;
  preferredEmail: string;
  preferredEmailIsExplicit: boolean;
}) {
  const normalizedPreferred = opts.preferredEmail.trim().toLowerCase();

  // If the preferred email is already used by another user, we must avoid violating the unique constraint.
  const ownerId = await findUserIdByEmailInsensitive(normalizedPreferred);
  if (!ownerId || (opts.currentUserId && ownerId === opts.currentUserId)) {
    return normalizedPreferred;
  }

  if (opts.preferredEmailIsExplicit) {
    throw new Error(
      `SEED email untuk username "${opts.username}" bentrok: ${normalizedPreferred} sudah dipakai user lain. Gunakan email lain di env atau kosongkan user yang memakai email tersebut.`
    );
  }

  // Auto-generate a unique dev email.
  const [localRaw, domainRaw] = normalizedPreferred.split("@");
  const local = localRaw || opts.username;
  const domain = domainRaw || "ppic.local";

  for (let i = 0; i < 50; i++) {
    const candidate = `${local}+${Date.now()}${i}@${domain}`;
    const candidateOwner = await findUserIdByEmailInsensitive(candidate);
    if (!candidateOwner) return candidate;
  }

  return `${opts.username}+${Date.now()}@ppic.local`;
}

async function ensureSystemUser(opts: {
  username: string;
  role: Role;
  passwordHash: string;
  fullName: string;
  preferredEmail: string;
  preferredEmailIsExplicit: boolean;
}) {
  const existing = await prisma.user.findUnique({ where: { username: opts.username }, select: { id: true } });
  const email = await ensureUniqueSystemEmail({
    username: opts.username,
    currentUserId: existing?.id ?? null,
    preferredEmail: opts.preferredEmail,
    preferredEmailIsExplicit: opts.preferredEmailIsExplicit,
  });

  const user = await prisma.user.upsert({
    where: { username: opts.username },
    update: { role: opts.role, passwordHash: opts.passwordHash, email },
    create: {
      username: opts.username,
      email,
      passwordHash: opts.passwordHash,
      role: opts.role,
    },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: { fullName: opts.fullName, email, status: "APPROVED" },
    create: {
      userId: user.id,
      registrationType: RegistrationType.PERSONAL,
      fullName: opts.fullName,
      email,
      status: "APPROVED",
    },
  });

  return user;
}

async function main() {
  const passwordAdmin = await bcrypt.hash("admin123", 10);
  const passwordFinance = await bcrypt.hash("finance123", 10);
  const passwordInstructor = await bcrypt.hash("instructor123", 10);

  // NOTE: These are the built-in *system* accounts (login by username).
  // Keep them stable and independent from SEED_* env vars (which are intended for creating additional accounts by email+password).
  const defaultAdminEmail = "admin@ppic.local";
  const defaultFinanceEmail = "finance@ppic.local";
  const defaultInstructorEmail = "instructor@ppic.local";

  const admin = await ensureSystemUser({
    username: "admin",
    role: Role.ADMIN,
    passwordHash: passwordAdmin,
    fullName: "System Admin",
    preferredEmail: defaultAdminEmail,
    preferredEmailIsExplicit: false,
  });

  await ensureSystemUser({
    username: "finance",
    role: Role.FINANCE,
    passwordHash: passwordFinance,
    fullName: "Finance Officer",
    preferredEmail: defaultFinanceEmail,
    preferredEmailIsExplicit: false,
  });

  await ensureSystemUser({
    username: "instructor",
    role: Role.INSTRUCTOR,
    passwordHash: passwordInstructor,
    fullName: "Default Instructor",
    preferredEmail: defaultInstructorEmail,
    preferredEmailIsExplicit: false,
  });

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (seedAdminEmail && seedAdminPassword) {
    await upsertByEmail({ email: seedAdminEmail, password: seedAdminPassword, role: Role.ADMIN, fullName: "Seed Admin" });
  }

  const seedFinanceEmail = process.env.SEED_FINANCE_EMAIL;
  const seedFinancePassword = process.env.SEED_FINANCE_PASSWORD;
  if (seedFinanceEmail && seedFinancePassword) {
    await upsertByEmail({ email: seedFinanceEmail, password: seedFinancePassword, role: Role.FINANCE, fullName: "Seed Finance" });
  }

  const seedInstructorEmail = process.env.SEED_INSTRUCTOR_EMAIL;
  const seedInstructorPassword = process.env.SEED_INSTRUCTOR_PASSWORD;
  if (seedInstructorEmail && seedInstructorPassword) {
    await upsertByEmail({ email: seedInstructorEmail, password: seedInstructorPassword, role: Role.INSTRUCTOR, fullName: "Seed Instructor" });
  }

  await prisma.simulator.upsert({
    where: { category_name: { category: AircraftCategory.AIRBUS, name: "A320" } },
    update: {},
    create: { category: AircraftCategory.AIRBUS, name: "A320" },
  });

  await prisma.simulator.upsert({
    where: { category_name: { category: AircraftCategory.BOEING, name: "B737" } },
    update: {},
    create: { category: AircraftCategory.BOEING, name: "B737" },
  });

  // Seed schedule slots: 11/03/2026 (11 March 2026) for 1 month forward
  const simulators = await prisma.simulator.findMany({ select: { id: true, category: true, name: true } });
  const start = new Date(2026, 2, 11, 0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const slotTemplates: Array<{ startHour: number; endHour: number }> = [
    { startHour: 9, endHour: 12 },
    { startHour: 13, endHour: 16 },
  ];

  let created = 0;
  for (const sim of simulators) {
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      for (const t of slotTemplates) {
        const startAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.startHour, 0, 0, 0);
        const endAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.endHour, 0, 0, 0);

        const exists = await prisma.scheduleSlot.findFirst({
          where: { simulatorId: sim.id, startAt, endAt },
          select: { id: true },
        });
        if (exists) continue;

        await prisma.scheduleSlot.create({
          data: {
            simulatorId: sim.id,
            startAt,
            endAt,
            status: "AVAILABLE",
            createdByAdminId: admin.id,
          },
        });
        created++;
      }
    }
  }

  console.log("Seed complete", { admin: admin.username, slotsCreated: created });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
