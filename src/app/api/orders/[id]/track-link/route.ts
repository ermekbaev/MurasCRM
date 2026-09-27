import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "MANAGER"];

/**
 * Ссылка статуса заказа для клиента.
 *
 * Токен создаётся при первом запросе и потом не меняется — ссылку можно
 * переслать один раз. Случайные 16 байт: подобрать чужую невозможно.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, publicToken: true } });
  if (!order) return apiError.notFound();

  let token = order.publicToken;
  if (!token) {
    token = randomBytes(16).toString("hex");
    await prisma.order.update({ where: { id }, data: { publicToken: token } });
  }

  return NextResponse.json({ token, path: `/track/${token}` });
}
