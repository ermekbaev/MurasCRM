import { redirect } from "next/navigation";
import { getBranding } from "@/lib/branding.server";
import { getLicenseStatus, type LicenseState } from "@/lib/license.server";
import LicenseForm from "./LicenseForm";

export const dynamic = "force-dynamic";

/** Что написать про состояние — понятным заказчику языком, без техножаргона. */
const MESSAGES: Record<LicenseState, string> = {
  disabled: "Лицензирование для этой установки не требуется.",
  active: "Лицензия активна.",
  grace: "Срок лицензии истёк, идёт отсрочка. Введите новый ключ, чтобы продлить.",
  expired: "Срок лицензии истёк. Система приостановлена — введите действующий ключ.",
  missing: "Лицензия ещё не активирована. Введите ключ, полученный от поставщика.",
  invalid: "Сохранённый ключ недействителен. Введите корректный ключ.",
  misconfigured: "Лицензия не настроена на сервере. Обратитесь к поставщику.",
};

export default async function LicensePage() {
  const [brand, status] = await Promise.all([getBranding(), getLicenseStatus()]);

  // Проверка выключена или всё в порядке — тут делать нечего.
  if (status.state === "disabled" || (status.state === "active" && !status.banner)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-card">
        <h1 className="text-lg font-semibold text-fg">{brand.name}</h1>
        <p className="mt-1 text-sm text-fg-muted">{MESSAGES[status.state]}</p>

        {status.expiresAt && (
          <p className="mt-3 text-xs text-fg-subtle">
            Ключ в системе действовал до {status.expiresAt}.
          </p>
        )}

        <div className="mt-6">
          <LicenseForm />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-fg-subtle">
          Ключ выдаёт поставщик системы. Данные вашей компании сохранены и
          станут доступны сразу после активации.
        </p>
      </div>
    </div>
  );
}
