import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateUploadUrl } from "@/lib/s3";
import { z } from "zod";
import { randomUUID } from "crypto";
import { notifyFilePendingApproval } from "@/lib/telegram";

const uploadRequestSchema = z.object({
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  category: z.enum(["SOURCES", "PENDING_APPROVAL", "APPROVED", "READY", "ARCHIVE"]).default("SOURCES"),
  linkedTo: z.string().optional(),
  linkedId: z.string().optional(),
  comment: z.string().optional(),
  replaceId: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "";
  const linkedId = searchParams.get("linkedId") || "";
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (linkedId) where.linkedId = linkedId;
  if (search) where.originalName = { contains: search, mode: "insensitive" };

  const files = await prisma.file.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
    take: 100,
  });

  return NextResponse.json(files.map((f) => ({
    ...f,
    size: f.size,
  })));
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { originalName, mimeType, size, category, linkedTo, linkedId, comment, replaceId } = parsed.data;

  // Determine version number
  let version = 1;
  let resolvedLinkedTo = linkedTo;
  let resolvedLinkedId = linkedId;
  if (replaceId) {
    const existing = await prisma.file.findUnique({ where: { id: replaceId } });
    if (existing) {
      version = existing.version + 1;
      resolvedLinkedTo = existing.linkedTo ?? undefined;
      resolvedLinkedId = existing.linkedId ?? undefined;
    }
  }

  // Generate unique S3 key
  const ext = originalName.split(".").pop() || "bin";
  const key = `uploads/${session.user.id}/${randomUUID()}.${ext}`;

  // Get presigned upload URL
  const uploadUrl = await generateUploadUrl(key, mimeType).catch(() => null);

  // Save file metadata
  const file = await prisma.file.create({
    data: {
      key,
      originalName,
      size,
      mimeType,
      category,
      version,
      uploadedById: session.user.id,
      linkedTo: resolvedLinkedTo,
      linkedId: resolvedLinkedId,
      comment,
    },
  });

  if (category === "PENDING_APPROVAL") notifyFilePendingApproval(file.id);

  return NextResponse.json({ file, uploadUrl }, { status: 201 });
}
