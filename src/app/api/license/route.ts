import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inspectKey } from "@/lib/license.server";
import { z } from "zod";

const schema = z.object({ key: z.string().min(1).max(4096) });

/**
 * Активация лицензии.
 *
 * Открыта без входа намеренно: когда срок истёк, в систему не попасть, а ключ
 * вставить надо. Подделать ничего нельзя — принимается только ключ с подписью
 * владельца, а сохраняется он лишь если ещё действует. Просроченным ключом
 * разблокировать не выйдет.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const key = parsed.data.key.trim();
  const status = inspectKey(key);

  if (status.state === "invalid") {
    return NextResponse.json(
      { error: "Ключ недействителен — проверьте, что скопировали его целиком." },
      { status: 400 },
    );
  }
  if (status.state === "misconfigured") {
    return NextResponse.json(
      { error: "На сервере не задан публичный ключ лицензии. Обратитесь к поставщику." },
      { status: 500 },
    );
  }
  if (status.locked) {
    return NextResponse.json(
      { error: `Срок этого ключа истёк (${status.expiresAt}). Нужен действующий.` },
      { status: 400 },
    );
  }

  const existing = await prisma.companySettings.findFirst({ select: { id: true } });
  if (existing) {
    await prisma.companySettings.update({ where: { id: existing.id }, data: { licenseKey: key } });
  } else {
    await prisma.companySettings.create({ data: { licenseKey: key } });
  }

  return NextResponse.json({ ok: true, expiresAt: status.expiresAt, org: status.org });
}
