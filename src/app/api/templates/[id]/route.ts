import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/s3";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["INVOICE", "ACT", "CONTRACT", "COMMERCIAL_OFFER", "OTHER"]).optional(),
  kind: z.enum(["TEXT", "DOCX"]).optional(),
  body: z.string().optional(),
  fileKey: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
  variables: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  // Раньше в update уходило тело запроса целиком — можно было записать любое
  // поле модели. Теперь принимаем только явно перечисленные.
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const existing = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!existing) return apiError.notFound();

  // Заменили файл бланка — прежний из хранилища убираем, иначе он останется
  // висеть навсегда.
  if (parsed.data.fileKey && existing.fileKey && parsed.data.fileKey !== existing.fileKey) {
    await deleteObject(existing.fileKey).catch(() => {});
  }

  const template = await prisma.documentTemplate.update({ where: { id }, data: parsed.data });
  return NextResponse.json(template);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) return apiError.notFound();

  if (template.fileKey) await deleteObject(template.fileKey).catch(() => {});

  await prisma.documentTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
