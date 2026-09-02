import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { onChatEvent } from "@/lib/chat-events";
import { CHAT_ROLES } from "@/lib/chat-roles";

export const dynamic = "force-dynamic";

/** Как часто сверяемся с базой, если событие пришло мимо нашего процесса. */
const RECHECK_MS = 10_000;
/** Пауза дольше минуты — и посредник закроет соединение как зависшее. */
const HEARTBEAT_MS = 25_000;

/**
 * Поток обновлений переписки (SSE).
 *
 * Отдаём только сигнал «что-то изменилось», без содержимого: браузер после
 * этого перечитывает диалог обычным запросом. Так права доступа и формат
 * ответа остаются в одном месте, а не дублируются в потоке.
 */
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: string, data: unknown) =>
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      // Отметка последнего изменения — чтобы подстраховочная сверка не слала
      // сигнал на каждом тике.
      let seen = (
        await prisma.conversation.aggregate({ _max: { lastMessageAt: true } })
      )._max.lastMessageAt?.getTime() ?? 0;

      send("ready", { ok: true });

      const off = onChatEvent((event) => {
        seen = Date.now();
        send("chat", event);
      });

      const recheck = setInterval(async () => {
        try {
          const max = (
            await prisma.conversation.aggregate({ _max: { lastMessageAt: true } })
          )._max.lastMessageAt?.getTime() ?? 0;
          if (max > seen) {
            seen = max;
            send("chat", { conversationId: null, direction: "IN" });
          }
        } catch {
          // База временно недоступна — попробуем на следующем тике.
        }
      }, RECHECK_MS);

      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        off();
        clearInterval(recheck);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Уже закрыт клиентом.
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Просьба посредникам не копить ответ в буфере.
      "X-Accel-Buffering": "no",
    },
  });
}
