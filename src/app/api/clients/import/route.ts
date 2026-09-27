import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const IMPORT_ROLES = ["ADMIN", "MANAGER"];

/** Одна строка из файла. Всё, кроме имени, необязательно. */
const rowSchema = z.object({
  name: z.string().trim().min(1).max(300),
  fullName: z.string().trim().max(500).optional().default(""),
  inn: z.string().trim().max(20).optional().default(""),
  kpp: z.string().trim().max(20).optional().default(""),
  ogrn: z.string().trim().max(20).optional().default(""),
  okpo: z.string().trim().max(20).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  legalAddress: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

const schema = z.object({
  clients: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

/** Тип клиента по длине ИНН: 10 — юрлицо, 12 — ИП, иначе физлицо. */
function inferType(inn: string): "INDIVIDUAL" | "LEGAL" | "IP" {
  const digits = inn.replace(/\D/g, "");
  if (digits.length === 10) return "LEGAL";
  if (digits.length === 12) return "IP";
  return "INDIVIDUAL";
}

const normPhone = (p: string) => p.replace(/\D/g, "");

/**
 * Массовый импорт клиентов из Excel.
 *
 * Строки уже разобраны и сопоставлены с полями на стороне браузера — сюда
 * приходит готовый список. Дубли не заводим: клиент считается тем же, если
 * совпал ИНН или телефон — и с тем, что уже в базе, и внутри самого файла.
 * Плохие строки не роняют импорт целиком: по каждой возвращаем причину.
 */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!IMPORT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest("Ожидался список клиентов");

  // Существующие ключи для дедупликации.
  const existing = await prisma.client.findMany({ select: { inn: true, phone: true } });
  const seenInn = new Set(existing.map((c) => c.inn?.trim()).filter(Boolean) as string[]);
  const seenPhone = new Set(
    existing.map((c) => (c.phone ? normPhone(c.phone) : "")).filter(Boolean),
  );

  let created = 0;
  let skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < parsed.data.clients.length; i++) {
    const raw = rowSchema.safeParse(parsed.data.clients[i]);
    if (!raw.success) {
      // Пустое имя — самая частая причина: просто пропускаем такую строку.
      const noName = raw.error.issues.some((x) => x.path[0] === "name");
      errors.push({ row: i + 1, reason: noName ? "нет названия" : "некорректные данные" });
      continue;
    }
    const c = raw.data;

    const innKey = c.inn.trim();
    const phoneKey = normPhone(c.phone);
    if ((innKey && seenInn.has(innKey)) || (phoneKey && seenPhone.has(phoneKey))) {
      skipped++;
      continue;
    }

    // Email оставляем, только если он похож на email — иначе просто без почты,
    // чтобы одна кривая ячейка не срывала всю строку.
    const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email) ? c.email : "";

    try {
      await prisma.client.create({
        data: {
          type: inferType(c.inn),
          name: c.name,
          fullName: c.fullName || null,
          inn: c.inn || null,
          kpp: c.kpp || null,
          ogrn: c.ogrn || null,
          okpo: c.okpo || null,
          phone: c.phone || null,
          email: email || null,
          legalAddress: c.legalAddress || null,
          notes: c.notes || null,
          source: "OTHER",
        },
      });
      created++;
      if (innKey) seenInn.add(innKey);
      if (phoneKey) seenPhone.add(phoneKey);
    } catch {
      errors.push({ row: i + 1, reason: "не удалось сохранить" });
    }
  }

  return NextResponse.json({ created, skipped, errors });
}
