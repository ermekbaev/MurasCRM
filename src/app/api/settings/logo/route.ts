import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateUploadUrl } from "@/lib/s3";
import { randomUUID } from "crypto";
import { z } from "zod";

const schema = z.object({
  mimeType: z.string(),
  field: z.enum(["logoKey", "stampKey", "signatureKey"]).default("logoKey"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { mimeType, field } = parsed.data;
  const ext = mimeType.split("/")[1] || "png";
  const key = `branding/${field}/${randomUUID()}.${ext}`;

  const uploadUrl = await generateUploadUrl(key, mimeType);

  // Save key to settings
  let settings = await prisma.companySettings.findFirst();
  if (settings) {
    await prisma.companySettings.update({ where: { id: settings.id }, data: { [field]: key } });
  } else {
    await prisma.companySettings.create({ data: { id: "default", [field]: key } });
  }

  return NextResponse.json({ uploadUrl, key });
}
