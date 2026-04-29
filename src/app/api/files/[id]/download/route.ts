import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateDownloadUrl } from "@/lib/s3";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role, id: userId } = session.user;
  const isPrivileged = ["ADMIN", "MANAGER", "ACCOUNTANT"].includes(role);
  const isOwner = file.uploadedById === userId;

  if (!isPrivileged && !isOwner) {
    // Restricted roles: check access via linked order or task
    if (file.linkedTo === "order" && file.linkedId) {
      const accessible = await prisma.order.findFirst({
        where: {
          id: file.linkedId,
          ...(role === "OPERATOR"
            ? { assignees: { some: { id: userId } } }
            : { OR: [{ assignees: { some: { id: userId } } }, { tasks: { some: { assigneeId: userId } } }] }),
        },
        select: { id: true },
      });
      if (!accessible) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (file.linkedTo === "task" && file.linkedId) {
      const accessible = await prisma.task.findFirst({
        where: { id: file.linkedId, assigneeId: userId },
        select: { id: true },
      });
      if (!accessible) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const url = await generateDownloadUrl(file.key, 3600);
  return NextResponse.json({ url, expiresIn: 3600 });
}
