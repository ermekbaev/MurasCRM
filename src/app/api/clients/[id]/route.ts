import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  type: z.enum(["INDIVIDUAL", "LEGAL", "IP"]).optional(),
  name: z.string().min(1).optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
  whatsapp: z.string().optional(),
  legalAddress: z.string().optional(),
  postalAddress: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankBik: z.string().optional(),
  corrAccount: z.string().optional(),
  source: z.enum(["REFERRAL", "ADVERTISING", "COLD_CALL", "SOCIAL_MEDIA", "OTHER"]).optional(),
  notes: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      },
      invoices: { orderBy: { date: "desc" }, take: 10 },
    },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const client = await prisma.client.update({ where: { id }, data: parsed.data });
  return NextResponse.json(client);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
