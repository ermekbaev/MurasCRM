import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { slugifyKebab } from "@/lib/slug";
import { ensureDefaultHelpArticles } from "@/lib/help-defaults.server";

const schema = z.object({
  title: z.string().min(1).max(160),
  category: z.string().min(1).max(80),
  body: z.string().default(""),
  sortOrder: z.number().int().optional(),
});

/** Статьи справки видят все сотрудники. */
export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();

  // Пустую базу знаний заполняем стартовым набором при первом обращении.
  await ensureDefaultHelpArticles();

  const articles = await prisma.helpArticle.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(articles);
}

/** Создавать и править статьи может только админ. */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  // Уникальный slug из названия.
  const base = slugifyKebab(parsed.data.title, "article");
  let slug = base;
  for (let i = 2; await prisma.helpArticle.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const max = await prisma.helpArticle.aggregate({ _max: { sortOrder: true } });
  const article = await prisma.helpArticle.create({
    data: {
      slug,
      title: parsed.data.title,
      category: parsed.data.category,
      body: parsed.data.body,
      sortOrder: parsed.data.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(article, { status: 201 });
}
