import { cache } from "react";
import { createPublicKey, verify } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Лицензия установки.
 *
 * Открытый механизм, а не скрытый рычаг: ключ подписан приватным ключом
 * владельца (ed25519), сервер проверяет подпись публичным ключом и не может
 * ничего подделать. Заказчик видит и код, и своё состояние лицензии на
 * странице /license — прятать тут нечего.
 *
 * Смысл — привязать срок пользования к оплате: выписывается ключ до даты, по
 * оплате выдаётся новый с большим сроком. Пока не оплачено — по истечении
 * срока и небольшого запаса система блокируется, данные заказчика при этом
 * остаются в базе целыми.
 *
 * Включается только там, где это нужно: при LICENSE_ENFORCED=true. На наших
 * установках и демо переменной нет — проверка не работает вовсе, поведение не
 * меняется.
 */

/** Сколько дней система ещё работает после даты окончания — с баннером. */
const GRACE_DAYS = 5;

/** За сколько дней до конца показывать предупреждение. */
const WARN_DAYS = 7;

export type LicenseState =
  | "disabled" // проверка выключена (наши установки)
  | "active" // ключ действует
  | "grace" // срок вышел, идёт запас дней до блокировки
  | "expired" // запас исчерпан — блокировка
  | "missing" // ключа нет
  | "invalid" // подпись не сошлась или ключ битый
  | "misconfigured"; // включено, но не задан публичный ключ

export interface LicenseStatus {
  state: LicenseState;
  /** Нужно ли перекрывать доступ к системе. */
  locked: boolean;
  org?: string;
  /** Дата окончания, ISO (ГГГГ-ММ-ДД). */
  expiresAt?: string;
  /** Дней до жёсткой блокировки; отрицательное — уже в запасе. */
  daysLeft?: number;
  /** Текст для баннера в интерфейсе; null — баннер не нужен. */
  banner?: { text: string; tone: "warning" | "danger" } | null;
}

interface Payload {
  org: string;
  exp: string;
}

function verifyKey(key: string, publicKeyB64: string): Payload | null {
  const dot = key.indexOf(".");
  if (dot < 1) return null;
  const payloadB64 = key.slice(0, dot);
  const sigB64 = key.slice(dot + 1);

  let pub;
  try {
    pub = createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    return null;
  }

  let ok = false;
  try {
    ok = verify(null, Buffer.from(payloadB64), pub, Buffer.from(sigB64, "base64url"));
  } catch {
    return null;
  }
  if (!ok) return null;

  try {
    const data = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (typeof data?.org === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data?.exp)) {
      return { org: data.org, exp: data.exp };
    }
  } catch {
    /* битый payload */
  }
  return null;
}

function ru(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Разбирает уже проверенный ключ в состояние по датам. Вынесено отдельно, чтобы
 * тем же кодом пользовалась и страница активации при вводе нового ключа.
 */
export function classify(payload: Payload): LicenseStatus {
  const now = Date.now();
  const exp = new Date(`${payload.exp}T23:59:59`).getTime();
  const hardLock = exp + GRACE_DAYS * 86400_000;
  const dayMs = 86400_000;
  const daysLeft = Math.ceil((hardLock - now) / dayMs);

  if (now <= exp) {
    const daysToExp = Math.ceil((exp - now) / dayMs);
    return {
      state: "active",
      locked: false,
      org: payload.org,
      expiresAt: payload.exp,
      daysLeft,
      banner:
        daysToExp <= WARN_DAYS
          ? { text: `Лицензия действует до ${ru(payload.exp)} — осталось ${daysToExp} дн.`, tone: "warning" }
          : null,
    };
  }

  if (now < hardLock) {
    return {
      state: "grace",
      locked: false,
      org: payload.org,
      expiresAt: payload.exp,
      daysLeft,
      banner: {
        text: `Срок лицензии истёк ${ru(payload.exp)}. Система будет заблокирована через ${daysLeft} дн. Свяжитесь с поставщиком.`,
        tone: "danger",
      },
    };
  }

  return {
    state: "expired",
    locked: true,
    org: payload.org,
    expiresAt: payload.exp,
    daysLeft,
  };
}

/** Публичный ключ владельца: только он проверяет подписи. Не секрет. */
function publicKey(): string | null {
  const k = process.env.LICENSE_PUBLIC_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

/**
 * Состояние лицензии для текущего запроса. Кэшируется на запрос: сколько бы
 * мест ни спросило (layout, страница активации), в базу сходим один раз.
 */
export const getLicenseStatus = cache(async (): Promise<LicenseStatus> => {
  if (process.env.LICENSE_ENFORCED !== "true") {
    return { state: "disabled", locked: false, banner: null };
  }

  const pub = publicKey();
  // Включили проверку, но не дали публичный ключ — это ошибка настройки.
  // Перекрываем доступ, а не открываем: иначе удалением одной строки из .env
  // защита бесшумно выключалась бы.
  if (!pub) return { state: "misconfigured", locked: true, banner: null };

  const key =
    process.env.LICENSE_KEY?.trim() ||
    (await prisma.companySettings
      .findFirst({ select: { licenseKey: true } })
      .then((s) => s?.licenseKey?.trim() || null)
      .catch(() => null));

  if (!key) return { state: "missing", locked: true, banner: null };

  const payload = verifyKey(key, pub);
  if (!payload) return { state: "invalid", locked: true, banner: null };

  return classify(payload);
});

/** Проверить и разобрать ключ вне контекста запроса — для страницы активации. */
export function inspectKey(key: string): LicenseStatus {
  const pub = publicKey();
  if (!pub) return { state: "misconfigured", locked: true, banner: null };
  const payload = verifyKey(key.trim(), pub);
  if (!payload) return { state: "invalid", locked: true, banner: null };
  return classify(payload);
}
