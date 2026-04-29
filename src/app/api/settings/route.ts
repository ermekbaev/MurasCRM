import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateDownloadUrl } from "@/lib/s3";
import { z } from "zod";

const settingsSchema = z.object({
  name: z.string().optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  legalAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankBik: z.string().optional(),
  corrAccount: z.string().optional(),
  director: z.string().optional(),
  accountant: z.string().optional(),
});

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: { id: "default" } });
  }
  const [logoUrl, stampUrl, signatureUrl] = await Promise.all([
    settings.logoKey       ? generateDownloadUrl(settings.logoKey).catch(() => null)       : null,
    settings.stampKey      ? generateDownloadUrl(settings.stampKey).catch(() => null)      : null,
    settings.signatureKey  ? generateDownloadUrl(settings.signatureKey).catch(() => null)  : null,
  ]);
  return NextResponse.json({ ...settings, logoUrl, stampUrl, signatureUrl });
}

export async function PATCH(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let settings = await prisma.companySettings.findFirst();

  if (settings) {
    settings = await prisma.companySettings.update({
      where: { id: settings.id },
      data: parsed.data,
    });
  } else {
    settings = await prisma.companySettings.create({
      data: { id: "default", ...parsed.data },
    });
  }

  return NextResponse.json(settings);
}
