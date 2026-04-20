import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateOrderNumber } from "@/lib/utils";
import { notifyNewOrder } from "@/lib/telegram";

const orderSchema = z.object({
  clientId: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "URGENT", "VERY_URGENT"]).default("NORMAL"),
  deadline: z.string().optional(),
  notes: z.string().optional(),
  equipmentId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.number().positive(),
    unit: z.string(),
    price: z.number().nonnegative(),
    discount: z.number().min(0).max(100).default(0),
    serviceId: z.string().optional(),
  })).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const type = searchParams.get("type") || "";
  const priority = searchParams.get("priority") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  // Operators only see their assigned orders
  if (session.user.role === "OPERATOR") {
    where.assignees = { some: { id: session.user.id } };
  }
  // Designers see assigned + orders they have tasks on
  if (session.user.role === "DESIGNER") {
    where.OR = [
      { assignees: { some: { id: session.user.id } } },
      { tasks: { some: { assigneeId: session.user.id } } },
    ];
  }

  if (search) {
    where.OR = [
      { number: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (status === "active") {
    where.status = { in: ["NEW", "IN_PROGRESS", "REVIEW"] };
  } else if (status === "completed") {
    where.status = { in: ["READY", "ISSUED"] };
  } else if (status && status !== "active" && status !== "completed") {
    where.status = status;
  }

  if (type) where.type = type;
  if (priority) where.priority = priority;

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items = [], assigneeIds = [], deadline, ...rest } = parsed.data;

  // Generate order number — count only current year
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const count = await prisma.order.count({ where: { createdAt: { gte: yearStart } } });
  const number = generateOrderNumber(count);

  // Calculate totals
  const calculatedItems = items.map((item) => {
    const total = item.qty * item.price * (1 - item.discount / 100);
    return { ...item, total };
  });
  const amount = calculatedItems.reduce((sum, i) => sum + i.total, 0);

  const order = await prisma.order.create({
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

  // fire-and-forget
  notifyNewOrder(order.id);

  return NextResponse.json(order, { status: 201 });
}
