import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  legalAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankBik: z.string().optional(),
  corrAccount: z.string().optional(),
  director: z.string().optional(),
  accountant: z.string().optional(),
});

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(companies);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = companySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const company = await prisma.company.create({ data: parsed.data });
  return NextResponse.json(company, { status: 201 });
}
