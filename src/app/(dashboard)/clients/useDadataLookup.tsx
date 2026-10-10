"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

/** Иконка поиска внутри поля — подставляет реквизиты из DaData. */
export function LookupButton({ onClick, busy, title }: { onClick: () => void; busy: boolean; title: string }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-label={title}
      className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-accent disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
    </button>
  );
}

interface RequisitesForm {
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  bankName: string;
  bankBik: string;
  corrAccount: string;
  fullName?: string;
  okpo?: string;
}

/**
 * Автозаполнение реквизитов через DaData: по ИНН — карточка организации,
 * по БИК — банк. Ошибки показываем текстом рядом с полем, форму не блокируем.
 * Поиск запускается и вручную (лупа), и сам — как только в поле набрано
 * полное значение (ИНН 10/12 цифр, БИК 9 цифр).
 */
export function useDadataLookup<T extends RequisitesForm>(
  form: T,
  setForm: React.Dispatch<React.SetStateAction<T>>,
) {
  const [lookup, setLookup] = useState<"party" | "bank" | null>(null);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);

  async function fillFromInn(value = form.inn) {
    const query = value.trim();
    if (!query) return;
    setLookup("party");
    setPartyError(null);
    try {
      const res = await fetch("/api/dadata/party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Не удалось получить данные");
      const d = json?.suggestions?.[0]?.data;
      if (!d) {
        setPartyError("Организация с таким ИНН не найдена");
        return;
      }
      setForm((f) => ({
        ...f,
        name: d.name?.short_with_opf || d.name?.full_with_opf || f.name,
        ...(f.fullName !== undefined && {
          fullName: d.name?.full_with_opf || d.name?.short_with_opf || f.fullName,
        }),
        inn: d.inn || f.inn,
        kpp: d.kpp || f.kpp,
        ogrn: d.ogrn || f.ogrn,
        ...(f.okpo !== undefined && { okpo: d.okpo || f.okpo }),
        legalAddress: d.address?.unrestricted_value || f.legalAddress,
      }));
    } catch (e) {
      setPartyError(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLookup(null);
    }
  }

  async function fillFromBik(value = form.bankBik) {
    const query = value.replace(/\D/g, "");
    if (!query) return;
    if (query.length !== 9) {
      setBankError("БИК состоит из 9 цифр");
      return;
    }
    setLookup("bank");
    setBankError(null);
    try {
      const res = await fetch("/api/dadata/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Не удалось получить данные");

      // На один БИК DaData может отдать несколько записей — головной банк и
      // ликвидированные филиалы. Берём только точное совпадение и действующий банк,
      // иначе подставится чужое название и устаревший корсчёт.
      type BankSuggestion = {
        data?: {
          bic?: string;
          correspondent_account?: string | null;
          name?: { payment?: string; short?: string };
          state?: { status?: string };
        };
      };
      const all: BankSuggestion[] = Array.isArray(json?.suggestions) ? json.suggestions : [];
      const exact = all.filter((s) => s.data?.bic === query);
      const d = (exact.find((s) => s.data?.state?.status === "ACTIVE") ?? exact[0])?.data;

      if (!d) {
        setBankError(
          all.length > 0
            ? "Точного совпадения по БИК нет — проверьте номер"
            : "Банк с таким БИК не найден",
        );
        return;
      }
      if (d.state?.status && d.state.status !== "ACTIVE") {
        setBankError("Внимание: по этому БИК банк не действующий");
      }

      setForm((f) => ({
        ...f,
        bankName: d.name?.payment || d.name?.short || f.bankName,
        bankBik: d.bic || f.bankBik,
        corrAccount: d.correspondent_account || f.corrAccount,
      }));
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLookup(null);
    }
  }

  function onInnChange(value: string) {
    setForm((f) => ({ ...f, inn: value }));
    setPartyError(null);
    const digits = value.replace(/\D/g, "");
    if (value.trim() === digits && (digits.length === 10 || digits.length === 12)) fillFromInn(digits);
  }

  function onBikChange(value: string) {
    setForm((f) => ({ ...f, bankBik: value }));
    setBankError(null);
    if (/^\d{9}$/.test(value.trim())) fillFromBik(value);
  }

  return { lookup, partyError, bankError, fillFromInn, fillFromBik, onInnChange, onBikChange };
}
