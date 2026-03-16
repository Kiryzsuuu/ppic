import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  fullName: z.string().max(120).optional(),
  companyName: z.string().max(160).nullable().optional(),
  npwp: z.string().max(40).nullable().optional(),
  email: z.string().email().max(160).nullable().optional(),
  placeOfBirth: z.string().max(120).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  ktpNumber: z.string().max(40).nullable().optional(),
  licenseNo: z.string().max(60).optional(),
  flightHours: z.number().int().nonnegative().optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(200).optional(),
});

export async function GET() {
  const { session, response } = await requireRole(["USER", "ADMIN", "FINANCE", "INSTRUCTOR"]);
  if (!session) return response;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { username: true, email: true },
  });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.userId },
    include: { documents: { orderBy: { uploadedAt: "desc" } } },
  });

  return jsonOk({ profile, user });
}

export async function PUT(req: NextRequest) {
  const { session, response } = await requireRole(["USER", "ADMIN", "FINANCE", "INSTRUCTOR"]);
  if (!session) return response;

  try {
    const body = await req.json();
    const input = UpdateProfileSchema.parse(body);

    const normalizedEmail =
      input.email === undefined ? undefined : input.email === null ? null : input.email.trim().toLowerCase();

    const profile = await prisma.$transaction(async (tx) => {
      if (normalizedEmail !== undefined) {
        await tx.user.update({
          where: { id: session.userId },
          data: { email: normalizedEmail },
        });
      }

      return await tx.profile.update({
        where: { userId: session.userId },
        data: {
          fullName: input.fullName,
          companyName: input.companyName === undefined ? undefined : input.companyName,
          npwp: input.npwp === undefined ? undefined : input.npwp,
          email: normalizedEmail === undefined ? undefined : normalizedEmail,
          placeOfBirth: input.placeOfBirth === undefined ? undefined : input.placeOfBirth,
          dateOfBirth: input.dateOfBirth === undefined ? undefined : input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          ktpNumber: input.ktpNumber === undefined ? undefined : input.ktpNumber,
          licenseNo: input.licenseNo,
          flightHours: input.flightHours,
          phone: input.phone,
          address: input.address,
        },
      });
    });

    return jsonOk({ profile });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Input tidak valid", 400, e.flatten());
    return jsonError("Server error", 500);
  }
}
