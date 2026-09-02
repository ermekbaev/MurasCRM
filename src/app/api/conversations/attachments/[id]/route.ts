import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateDownloadUrl } from "@/lib/s3";
import { CHAT_ROLES } from "@/lib/chat-roles";

/**
 * Ссылка на вложение переписки.
 *
 * Ключ хранилища наружу не отдаём: подписанная ссылка выдаётся на час и только
 * тому, кому переписка вообще доступна.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const attachment = await prisma.messageAttachment.findUnique({ where: { id } });
  if (!attachment) return apiError.notFound();
  if (!attachment.key) {
    return apiError.badRequest(attachment.failReason ?? "Файл не сохранён");
  }

  const url = await generateDownloadUrl(attachment.key, 3600);

  // ?raw=1 — сразу переброс на файл: так работают <img> в переписке и обычное
  // открытие вложения по ссылке, без промежуточного запроса за адресом.
  if (new URL(req.url).searchParams.get("raw")) {
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ url, name: attachment.name });
}
