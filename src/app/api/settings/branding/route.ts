import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getObjectWithType } from "@/lib/s3";

/**
 * Логотип, печать и подпись компании — через наш домен.
 *
 * Раньше в документ подставлялась подписанная ссылка прямо в хранилище. На
 * экране картинки показывались, а в PDF пропадали: снимок страницы не может
 * прочитать изображение с чужого домена, если тот не разрешил это заголовками
 * CORS. У R2 такой политики по умолчанию нет, и настраивать её каждому клиенту
 * — лишний шаг при продаже.
 *
 * Поэтому байты отдаём сами. Ключ наружу не принимаем: он берётся из настроек
 * по виду картинки, так что этой точкой нельзя вытащить произвольный файл.
 */
const KINDS = ["logo", "stamp", "signature"] as const;
type Kind = (typeof KINDS)[number];

const FIELD: Record<Kind, "logoKey" | "stampKey" | "signatureKey"> = {
  logo: "logoKey",
  stamp: "stampKey",
  signature: "signatureKey",
};

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();

  const kind = new URL(req.url).searchParams.get("kind") as Kind | null;
  if (!kind || !KINDS.includes(kind)) {
    return apiError.badRequest("Укажите kind: logo, stamp или signature");
  }

  const settings = await prisma.companySettings.findFirst();
  const key = settings?.[FIELD[kind]];
  if (!key) return apiError.notFound();

  try {
    const { buffer, contentType } = await getObjectWithType(key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        // Картинки меняются редко, а документ открывают часто.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return apiError.notFound();
  }
}
