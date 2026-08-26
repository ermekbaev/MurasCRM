import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { slugifyTaskColumnCode } from "@/lib/taskColumns";
import { getTaskColumns } from "@/lib/taskColumns.server";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().max(16).optional(),
  isActive: z.boolean().default(true),
  isStart: z.boolean().default(false),
  isFinal: z.boolean().default(false),
});

const reorderSchema = z.object({
  order: z.array(z.string()).min(1),
});

export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();

  return NextResponse.json(await getTaskColumns());
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return apiError.forbidden();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const base = slugifyTaskColumnCode(parsed.data.name);
  let code = base;
  for (let i = 2; await prisma.taskColumn.findUnique({ where: { code } }); i++) {
    code = `${base}_${i}`;
  }

  const max = await prisma.taskColumn.aggregate({ _max: { sortOrder: true } });
  const column = await prisma.taskColumn.create({
    data: { ...parsed.data, code, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(column, { status: 201 });
}

/** Перестановка этапов: принимает массив id в нужном порядке. */
export async function PUT(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return apiError.forbidden();

  const parsed = reorderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  await prisma.$transaction(
    parsed.data.order.map((id, index) =>
      prisma.taskColumn.update({ where: { id }, data: { sortOrder: index + 1 } }),
    ),
  );
  return NextResponse.json(await getTaskColumns());
}
