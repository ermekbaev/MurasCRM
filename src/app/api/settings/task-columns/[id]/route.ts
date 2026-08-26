import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.string().max(16).optional(),
  isActive: z.boolean().optional(),
  isStart: z.boolean().optional(),
  isFinal: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const column = await prisma.taskColumn.update({ where: { id }, data: parsed.data });
  return NextResponse.json(column);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const { id } = await params;
  const column = await prisma.taskColumn.findUnique({ where: { id } });
  if (!column) return apiError.notFound();

  // Этап с задачами удалять нельзя — задачи остались бы с «висящим» кодом
  // и пропали бы с доски.
  const used = await prisma.task.count({ where: { status: column.code } });
  if (used > 0) {
    return NextResponse.json(
      { error: `На этапе ${used} задач(и). Перенесите их или отключите этап вместо удаления.` },
      { status: 409 },
    );
  }

  // Последний этап оставляем: без колонок доска станет пустой.
  const total = await prisma.taskColumn.count();
  if (total <= 1) {
    return NextResponse.json(
      { error: "Нельзя удалить единственный этап." },
      { status: 409 },
    );
  }

  await prisma.taskColumn.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
