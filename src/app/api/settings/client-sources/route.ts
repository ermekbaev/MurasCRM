import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { slugifyClientSourceCode } from "@/lib/clientSources";

const schema = z.object({
  label: z.string().min(1).max(64),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();

  const sources = await prisma.clientSourceOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(sources);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  // Уникальный машинный код из названия
  const base = slugifyClientSourceCode(parsed.data.label);
  let code = base;
  for (let i = 2; await prisma.clientSourceOption.findUnique({ where: { code } }); i++) {
    code = `${base}_${i}`;
  }

  const max = await prisma.clientSourceOption.aggregate({ _max: { sortOrder: true } });
  const source = await prisma.clientSourceOption.create({
    data: {
      code,
      label: parsed.data.label,
      isActive: parsed.data.isActive,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(source, { status: 201 });
}
