import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectWithType } from "@/lib/s3";

/**
 * Значок установки для интерфейса.
 *
 * Отдаётся без входа в систему — в отличие от печати и подписи, которые лежат
 * в /api/settings/branding под проверкой прав. Логотип и так видит каждый, кто
 * открыл страницу входа, скрывать его не от кого, а показать его надо как раз
 * до входа.
 *
 * Ключ наружу не принимается: он берётся из настроек, так что произвольный
 * файл из хранилища этой точкой не вытащить.
 */
export async function GET() {
  const settings = await prisma.companySettings.findFirst({
    select: { interfaceLogoKey: true },
  });
  const key = settings?.interfaceLogoKey;
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { buffer, contentType } = await getObjectWithType(key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        // Значок висит на каждой странице и меняется раз в жизни установки.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
