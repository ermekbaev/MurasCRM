import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateDownloadUrl } from "@/lib/s3";
import { z } from "zod";

/** Стартовый номер нумерации: число либо «не задано». */
const startNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().int().min(1).max(999999).nullable(),
).optional();

const settingsSchema = z.object({
  name: z.string().optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  okpo: z.string().optional(),
  legalAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankBik: z.string().optional(),
  corrAccount: z.string().optional(),
  director: z.string().optional(),
  directorTitle: z.string().optional(),
  invoiceNotice: z.string().optional(),
  accountant: z.string().optional(),
  orderPrefix: z.string().max(12).optional(),
  invoicePrefix: z.string().max(12).optional(),
  actPrefix: z.string().max(12).optional(),
  waybillPrefix: z.string().max(12).optional(),
  // Пустое поле формы приходит строкой "" — это «не задано», а не ноль.
  orderStartNumber: startNumber,
  invoiceStartNumber: startNumber,
  actStartNumber: startNumber,
  waybillStartNumber: startNumber,
  worksWithVat: z.boolean().optional(),
  // coerce, а не number: Prisma отдаёт Decimal строкой, и форма возвращает
  // её обратно как строку — строгий z.number() ронял сохранение целиком.
  defaultVatRate: z.coerce.number().min(0).max(100).optional(),
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
  return NextResponse.json({
    ...settings,
    defaultVatRate: Number(settings.defaultVatRate),
    logoUrl,
    stampUrl,
    signatureUrl,
  });
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

  // Год привязки проставляем сами: стартовый номер осмыслен только в том году,
  // когда его задали, иначе первого января нумерация прыгнула бы обратно на него.
  const startKeys = [
    "orderStartNumber",
    "invoiceStartNumber",
    "actStartNumber",
    "waybillStartNumber",
  ] as const;
  const touchesStart = startKeys.some((k) => k in body);
  const data: Record<string, unknown> = { ...parsed.data };
  if (touchesStart) {
    const anySet = startKeys.some((k) => parsed.data[k] != null);
    data.numberStartYear = anySet ? new Date().getFullYear() : null;
  }

  let settings = await prisma.companySettings.findFirst();

  if (settings) {
    settings = await prisma.companySettings.update({
      where: { id: settings.id },
      data,
    });
  } else {
    settings = await prisma.companySettings.create({
      data: { id: "default", ...data },
    });
  }

  return NextResponse.json({ ...settings, defaultVatRate: Number(settings.defaultVatRate) });
}
