import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(1),
  position: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  telegram: z.string().optional(),
  whatsapp: z.string().optional(),
  note: z.string().optional(),
});

const CONTACT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CONTACT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const contacts = await prisma.clientContact.findMany({
    where: { clientId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(contacts);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CONTACT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!client) return apiError.notFound();

  const parsed = contactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  // Новый контакт встаёт в конец списка.
  const last = await prisma.clientContact.findFirst({
    where: { clientId: id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const contact = await prisma.clientContact.create({
    data: { ...parsed.data, clientId: id, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(contact, { status: 201 });
}
