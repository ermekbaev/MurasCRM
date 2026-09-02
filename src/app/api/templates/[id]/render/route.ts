import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_VAR_KEYS, type DocumentVarKey } from "@/lib/documentVars";
import { buildTemplateVars } from "@/lib/templateVars.server";

const DOCUMENT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

function substitute(body: string, vars: Partial<Record<DocumentVarKey, string>>): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const name = key.trim() as DocumentVarKey;
    if (vars[name] !== undefined) return vars[name] as string;
    // Известная переменная без данных в этом контексте — пусто. Видимой
    // оставляем только незнакомую: это опечатка в шаблоне.
    return DOCUMENT_VAR_KEYS.includes(name) ? "" : `{{${name}}}`;
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  // Документ собирается из реквизитов компании, данных клиента и сумм счёта —
  // то есть из того, что видят только роли, работающие с документами.
  if (!DOCUMENT_ROLES.includes(session.user.role)) return apiError.forbidden();
  const { id } = await params;

  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { orderId, invoiceId, clientId } = await req.json();
  const vars = await buildTemplateVars({ orderId, invoiceId, clientId });

  const rendered = substitute(template.body, vars);
  return NextResponse.json({ rendered, variables: vars });
}
