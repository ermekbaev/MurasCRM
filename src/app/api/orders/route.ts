import { NextResponse } from "next/server";
import { requireAuth, retryOnDuplicate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateOrderNumber } from "@/lib/utils";
import { notifyNewOrder } from "@/lib/telegram";

const orderSchema = z.object({
  clientId: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "URGENT", "VERY_URGENT"]).default("NORMAL"),
  deadline: z.string().optional(),
  notes: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.number().positive(),
    unit: z.string(),
    price: z.number().nonnegative(),
    discount: z.number().min(0).max(100).default(0),
    equipmentId: z.string().optional(),
  })).optional(),
});

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const queryParsed = z.object({
    search: z.string().default(""),
    status: z.string().default(""),
    type: z.string().default(""),
    priority: z.string().default(""),
    page: z.coerce.number().int().positive().max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }).safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) return NextResponse.json({ error: queryParsed.error.flatten() }, { status: 400 });
  const { search, status, type, priority, page, limit } = queryParsed.data;
  const skip = (page - 1) * limit;

  // Build conditions with AND so role filters are never overwritten by search OR
  const AND: Record<string, unknown>[] = [];

  if (session.user.role === "OPERATOR") {
    AND.push({ assignees: { some: { id: session.user.id } } });
  } else if (session.user.role === "DESIGNER") {
    AND.push({
      OR: [
        { assignees: { some: { id: session.user.id } } },
        { tasks: { some: { assigneeId: session.user.id } } },
      ],
    });
  }

  if (search) {
    AND.push({
      OR: [
        { number: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (status === "active") {
    AND.push({ status: { in: ["NEW", "IN_PROGRESS", "REVIEW"] } });
  } else if (status === "completed") {
    AND.push({ status: { in: ["READY", "ISSUED"] } });
  } else if (status) {
    AND.push({ status });
  }

  if (type) AND.push({ type });
  if (priority) AND.push({ priority });

  const where = AND.length ? { AND } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        assignees: { select: { id: true, name: true } },
        _count: { select: { items: true, tasks: true, comments: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items = [], assigneeIds = [], deadline, ...rest } = parsed.data;

  const calculatedItems = items.map((item) => {
    const total = item.qty * item.price * (1 - item.discount / 100);
    return { ...item, total };
  });
  const amount = calculatedItems.reduce((sum, i) => sum + i.total, 0);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const order = await retryOnDuplicate(async (attempt) => {
    const count = await prisma.order.count({ where: { createdAt: { gte: yearStart } } });
    const number = generateOrderNumber(count + attempt);
    return prisma.order.create({
      data: {
        ...rest,
        number,
        amount,
        deadline: deadline ? new Date(deadline) : undefined,
        managerId: session.user.id,
        assignees: assigneeIds.length ? { connect: assigneeIds.map((id) => ({ id })) } : undefined,
        items: calculatedItems.length ? { create: calculatedItems } : undefined,
      },
      include: {
        client: { select: { name: true } },
        manager: { select: { name: true } },
        assignees: { select: { id: true, name: true } },
        items: true,
      },
    });
  });

  notifyNewOrder(order.id).catch(console.error);

  return NextResponse.json(order, { status: 201 });
}
