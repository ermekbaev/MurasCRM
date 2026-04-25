import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { putObject, generateDownloadUrl } from "@/lib/s3";
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
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
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

  let settings = await prisma.companySettings.findFirst();
  if (settings) {
    await prisma.companySettings.update({ where: { id: settings.id }, data: { [field]: key } });
  } else {
    await prisma.companySettings.create({ data: { id: "default", [field]: key } });
  }

  const url = await generateDownloadUrl(key);
  return NextResponse.json({ url });
}
