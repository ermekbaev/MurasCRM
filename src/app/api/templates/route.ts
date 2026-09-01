import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INVOICE", "ACT", "CONTRACT", "COMMERCIAL_OFFER", "OTHER"]).default("OTHER"),
  kind: z.enum(["TEXT", "DOCX"]).default("TEXT"),
  body: z.string().default(""),
  fileKey: z.string().optional(),
  fileName: z.string().optional(),
  variables: z.array(z.string()).default([]),
});

export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();

  const templates = await prisma.documentTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) return apiError.forbidden();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const data = parsed.data;
  if (data.kind === "DOCX" && !data.fileKey) {
    return apiError.badRequest("Загрузите файл .docx");
  }
  if (data.kind === "TEXT" && !data.body.trim()) {
    return apiError.badRequest("Заполните содержимое шаблона");
  }

  const template = await prisma.documentTemplate.create({ data });
  return NextResponse.json(template, { status: 201 });
}
