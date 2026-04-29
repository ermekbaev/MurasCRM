import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateUploadUrl } from "@/lib/s3";
import { z } from "zod";
import { randomUUID } from "crypto";
import { notifyFilePendingApproval } from "@/lib/telegram";

const attachSchema = z.object({
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  category: z.enum(["SOURCES", "PENDING_APPROVAL", "APPROVED", "READY", "ARCHIVE"]).default("SOURCES"),
  comment: z.string().optional(),
  version: z.number().int().min(1).default(1),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const orderFiles = await prisma.orderFile.findMany({
    where: { orderId: id },
    include: {
      file: {
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orderFiles);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { originalName, mimeType, size, category, comment, version } = parsed.data;

  const ext = originalName.split(".").pop() || "bin";
  const key = `orders/${id}/${randomUUID()}.${ext}`;

  const uploadUrl = await generateUploadUrl(key, mimeType).catch(() => null);

  const file = await prisma.file.create({
    data: {
      key,
      originalName,
      size,
      mimeType,
      category,
      uploadedById: session.user.id,
      linkedTo: "order",
      linkedId: id,
      comment,
    },
  });

  const orderFile = await prisma.orderFile.create({
    data: { orderId: id, fileId: file.id, version, comment },
    include: { file: { include: { uploadedBy: { select: { id: true, name: true } } } } },
  });

  if (category === "PENDING_APPROVAL") notifyFilePendingApproval(file.id);

  return NextResponse.json({ orderFile, uploadUrl }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const orderFileId = searchParams.get("orderFileId");
  if (!orderFileId) return NextResponse.json({ error: "orderFileId required" }, { status: 400 });

  const orderFile = await prisma.orderFile.findFirst({
    where: { id: orderFileId, orderId: id },
  });
  if (!orderFile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.orderFile.delete({ where: { id: orderFileId } });
  return NextResponse.json({ ok: true });
}
