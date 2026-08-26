import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api";

const schema = z.object({ query: z.string().min(1) });

/** Реквизиты банка DaData: поиск по БИК. */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ suggestions: [] });

  const apiKey = process.env.DADATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DaData не настроена: нет DADATA_API_KEY" }, { status: 503 });
  }

  const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/bank", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Token ${apiKey}`,
    },
    body: JSON.stringify({ query: parsed.data.query, count: 20 }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "DaData вернула ошибку" }, { status: 502 });
  }
  return NextResponse.json(await res.json());
}
