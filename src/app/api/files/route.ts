import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateUploadUrl } from "@/lib/s3";
import { z } from "zod";
import { randomUUID } from "crypto";
import { notifyFilePendingApproval } from "@/lib/telegram";

const uploadRequestSchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(500 * 1024 * 1024), // лимит 500 МБ
  category: z.enum(["SOURCES", "PENDING_APPROVAL", "APPROVED", "READY", "ARCHIVE"]).default("SOURCES"),
  linkedTo: z.string().optional(),
  linkedId: z.string().optional(),
  comment: z.string().optional(),
  replaceId: z.string().optional(),
});

// Блокируем форматы, которые могут исполняться в браузере / через S3 при отдаче
const BLOCKED_EXTENSIONS = new Set([
  "html", "htm", "xhtml", "js", "mjs", "exe", "bat", "cmd", "sh",
  "ps1", "vbs", "jar", "msi", "scr", "com", "php", "asp", "aspx", "jsp", "py",
]);
const BLOCKED_MIME_PREFIXES = ["text/html", "application/javascript", "application/x-msdownload"];

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "";
  const linkedId = searchParams.get("linkedId") || "";
  const search = searchParams.get("search") || "";

  const { role, id: userId } = session.user;
  const isPrivileged = ["ADMIN", "MANAGER", "ACCOUNTANT"].includes(role);

  const AND: Record<string, unknown>[] = [];
  if (category) AND.push({ category });
  if (linkedId) AND.push({ linkedId });
  if (search) AND.push({ originalName: { contains: search, mode: "insensitive" } });

  if (!isPrivileged) {
    const orderFilter =
      role === "OPERATOR"
        ? { assignees: { some: { id: userId } } }
        : { OR: [{ assignees: { some: { id: userId } } }, { tasks: { some: { assigneeId: userId } } }] };

    const [accessibleOrders, accessibleTasks] = await Promise.all([
      prisma.order.findMany({ where: orderFilter, select: { id: true } }),
      prisma.task.findMany({ where: { assigneeId: userId }, select: { id: true } }),
    ]);
    const orderIds = accessibleOrders.map((o) => o.id);
    const taskIds = accessibleTasks.map((t) => t.id);

    AND.push({
      OR: [
        { uploadedById: userId },
        { linkedTo: "order", linkedId: { in: orderIds } },
        { linkedTo: "task", linkedId: { in: taskIds } },
      ],
    });
  }

  const where = AND.length ? { AND } : {};

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

  // Whitelist расширения / mime
  const ext = (originalName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `Тип файла .${ext} запрещён` }, { status: 400 });
  }
  if (BLOCKED_MIME_PREFIXES.some((p) => mimeType.toLowerCase().startsWith(p))) {
    return NextResponse.json({ error: "Этот mime-тип запрещён" }, { status: 400 });
  }

  // Determine version number
  let version = 1;
  let resolvedLinkedTo = linkedTo;
  let resolvedLinkedId = linkedId;
  if (replaceId) {
    const existing = await prisma.file.findUnique({ where: { id: replaceId } });
    if (!existing) {
      return NextResponse.json({ error: "Replace target not found" }, { status: 404 });
    }
    // Только владелец оригинала, ADMIN или MANAGER могут заменять файл
    const canReplace =
      existing.uploadedById === session.user.id ||
      ["ADMIN", "MANAGER"].includes(session.user.role);
    if (!canReplace) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    version = existing.version + 1;
    resolvedLinkedTo = existing.linkedTo ?? undefined;
    resolvedLinkedId = existing.linkedId ?? undefined;
  }

  // Generate unique S3 key
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
