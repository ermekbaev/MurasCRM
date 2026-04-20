import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import OrderDetailClient from "./OrderDetailClient";
import { generateDownloadUrl } from "@/lib/s3";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [order, users, services, equipment] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        manager: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, type: true } },
        assignees: { select: { id: true, name: true, role: true } },
        items: { include: { service: { select: { name: true, unit: true } } } },
        files: {
          include: { file: { include: { uploadedBy: { select: { id: true, name: true } } } } },
          orderBy: { createdAt: "desc" },
        },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        changeLogs: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.user.findMany({
      where: { isBlocked: false },
      select: { id: true, name: true, role: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, name: true, unit: true, price: true, type: true },
    }),
    prisma.equipment.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  if (!order) notFound();

  const filesWithUrls = await Promise.all(
    order.files.map(async (of) => ({
      id: of.id,
      version: of.version,
      status: of.status,
      comment: of.comment,
      createdAt: of.createdAt.toISOString(),
      file: {
        ...of.file,
        createdAt: of.file.createdAt.toISOString(),
        downloadUrl: await generateDownloadUrl(of.file.key).catch(() => null),
      },
    }))
  );

  return (
    <OrderDetailClient
      order={{
        ...order,
        amount: Number(order.amount),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        deadline: order.deadline?.toISOString() || null,
        equipment: order.equipment ?? null,
        files: filesWithUrls,
        items: order.items.map((i) => ({
          ...i,
          qty: Number(i.qty),
          price: Number(i.price),
          discount: Number(i.discount),
          total: Number(i.total),
        })),
        comments: order.comments.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })),
        changeLogs: order.changeLogs.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
        })),
      }}
      users={users}
      services={services.map((s) => ({ ...s, price: Number(s.price) }))}
      equipment={equipment}
      currentUserId={session?.user.id || ""}
      currentRole={session?.user.role || "MANAGER"}
    />
  );
}
