import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateDownloadUrl } from "@/lib/s3";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  let settings = await prisma.companySettings.findFirst();

  if (settings) {
    settings = await prisma.companySettings.update({
      where: { id: settings.id },
      data: body,
    });
  } else {
    settings = await prisma.companySettings.create({
      data: { id: "default", ...body },
    });
  }

  return NextResponse.json(settings);
}
