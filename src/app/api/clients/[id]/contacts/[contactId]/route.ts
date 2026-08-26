import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  telegram: z.string().optional(),
  whatsapp: z.string().optional(),
  note: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const CONTACT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

type Params = { params: Promise<{ id: string; contactId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CONTACT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id, contactId } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  // clientId в условии — чтобы нельзя было править чужой контакт по прямому id.
  const { count } = await prisma.clientContact.updateMany({
    where: { id: contactId, clientId: id },
    data: parsed.data,
  });
  if (count === 0) return apiError.notFound();

  const contact = await prisma.clientContact.findUnique({ where: { id: contactId } });
  return NextResponse.json(contact);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CONTACT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id, contactId } = await params;
  const { count } = await prisma.clientContact.deleteMany({
    where: { id: contactId, clientId: id },
  });
  if (count === 0) return apiError.notFound();

  return NextResponse.json({ ok: true });
}
