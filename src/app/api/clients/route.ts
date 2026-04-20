import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const clientSchema = z.object({
  type: z.enum(["INDIVIDUAL", "LEGAL", "IP"]).default("INDIVIDUAL"),
  name: z.string().min(1),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  telegram: z.string().optional(),
  whatsapp: z.string().optional(),
  legalAddress: z.string().optional(),
  postalAddress: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankBik: z.string().optional(),
  corrAccount: z.string().optional(),
  source: z.enum(["REFERRAL", "ADVERTISING", "COLD_CALL", "SOCIAL_MEDIA", "OTHER"]).default("OTHER"),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
      { inn: { contains: search } },
    ];
  }
  if (type) where.type = type;

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { status: { not: "CANCELLED" } },
          select: { amount: true },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  const result = clients.map((c) => ({
    ...c,
    ordersCount: c._count.orders,
    totalAmount: c.orders.reduce((sum, o) => sum + Number(o.amount), 0),
    orders: undefined,
    _count: undefined,
  }));

  return NextResponse.json({ clients: result, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const client = await prisma.client.create({ data: parsed.data });
  return NextResponse.json(client, { status: 201 });
}
