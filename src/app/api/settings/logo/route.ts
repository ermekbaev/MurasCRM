import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { putObject, generateDownloadUrl, deleteObject } from "@/lib/s3";
import { randomUUID } from "crypto";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const ALLOWED_FIELDS = ["logoKey", "stampKey", "signatureKey"] as const;
type BrandingField = typeof ALLOWED_FIELDS[number];

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const field = formData.get("field") as string | null;

  if (!file || !field || !ALLOWED_FIELDS.includes(field as BrandingField)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const key = `branding/${field}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await putObject(key, buffer, file.type);

  const settings = await prisma.companySettings.findFirst();
  const prevKey = settings?.[field as BrandingField] ?? null;

  if (settings) {
    await prisma.companySettings.update({ where: { id: settings.id }, data: { [field]: key } });
  } else {
    await prisma.companySettings.create({ data: { id: "default", [field]: key } });
  }

  // При замене прежний файл больше ничем не используется — убираем его,
  // иначе каждая замена навсегда оставляет мусор в хранилище.
  if (prevKey && prevKey !== key) {
    try {
      await deleteObject(prevKey);
    } catch {
      // намеренно игнорируем — новая картинка уже сохранена
    }
  }

  const url = await generateDownloadUrl(key);
  return NextResponse.json({ url });
}

export async function DELETE(req: Request) {
  const session = await requireAuth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const field = new URL(req.url).searchParams.get("field");
  if (!field || !ALLOWED_FIELDS.includes(field as BrandingField)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const settings = await prisma.companySettings.findFirst();
  const key = settings?.[field as BrandingField];
  if (!settings || !key) {
    return NextResponse.json({ ok: true });
  }

  await prisma.companySettings.update({ where: { id: settings.id }, data: { [field]: null } });

  // Объект убираем после того, как ссылка снята: если хранилище недоступно,
  // картинка всё равно исчезнет из интерфейса, а не останется битой.
  try {
    await deleteObject(key);
  } catch {
    // намеренно игнорируем — очистка поля важнее
  }

  return NextResponse.json({ ok: true });
}
