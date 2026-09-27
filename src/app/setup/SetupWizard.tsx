"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  Building2,
  Stamp,
  Users,
  Check,
  Loader2,
  Upload,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

type Role = "ADMIN" | "MANAGER" | "DESIGNER" | "OPERATOR" | "ACCOUNTANT";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "MANAGER", label: "Менеджер" },
  { value: "DESIGNER", label: "Дизайнер" },
  { value: "OPERATOR", label: "Оператор" },
  { value: "ACCOUNTANT", label: "Бухгалтер" },
  { value: "ADMIN", label: "Администратор" },
];

const STEPS = ["Реквизиты", "Печать и подпись", "Сотрудники", "Готово"];

const emptyCompany = {
  name: "",
  inn: "",
  kpp: "",
  ogrn: "",
  okpo: "",
  legalAddress: "",
  phone: "",
  email: "",
  director: "",
  directorTitle: "Генеральный директор",
  accountant: "",
  bankName: "",
  bankAccount: "",
  bankBik: "",
  corrAccount: "",
  worksWithVat: false,
};

type Asset = "logoKey" | "stampKey" | "signatureKey";

/**
 * Пошаговая настройка новой установки. Каждый шаг сохраняется своей ручкой
 * (реквизиты — /api/settings, картинки — /api/settings/logo, сотрудники —
 * /api/users), в конце ставится отметка о завершении. Любой шаг, кроме
 * реквизитов, можно пропустить и заполнить позже в настройках.
 */
export default function SetupWizard({ brandName }: { brandName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState(emptyCompany);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [finishing, setFinishing] = useState(false);

  const set = (k: keyof typeof emptyCompany, v: string | boolean) =>
    setCompany((c) => ({ ...c, [k]: v }));

  async function saveCompanyAndNext() {
    if (!company.name.trim()) {
      setCompanyError("Название компании обязательно — оно идёт в документы");
      return;
    }
    setSavingCompany(true);
    setCompanyError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      if (!res.ok) {
        setCompanyError("Не удалось сохранить реквизиты, проверьте поля");
        return;
      }
      setStep(1);
    } finally {
      setSavingCompany(false);
    }
  }

  async function finish() {
    setFinishing(true);
    await fetch("/api/setup/complete", { method: "POST" }).catch(() => {});
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-fg">Настройка {brandName}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Пара минут — и система готова к работе. Всё можно поменять позже в настройках.
          </p>
        </div>

        {/* Шаги */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
                  (i < step
                    ? "bg-accent text-on-accent"
                    : i === step
                      ? "bg-accent-soft text-accent-fg ring-1 ring-inset ring-accent/30"
                      : "bg-surface-hover text-fg-subtle")
                }
              >
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={"h-px w-6 " + (i < step ? "bg-accent" : "bg-line")} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          {step === 0 && (
            <CompanyStep
              company={company}
              set={set}
              error={companyError}
              saving={savingCompany}
              onNext={saveCompanyAndNext}
            />
          )}
          {step === 1 && <AssetsStep onBack={() => setStep(0)} onNext={() => setStep(2)} />}
          {step === 2 && <StaffStep onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && <DoneStep brandName={brandName} finishing={finishing} onFinish={finish} />}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/15">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>
      </div>
    </div>
  );
}

function CompanyStep({
  company,
  set,
  error,
  saving,
  onNext,
}: {
  company: typeof emptyCompany;
  set: (k: keyof typeof emptyCompany, v: string | boolean) => void;
  error: string;
  saving: boolean;
  onNext: () => void;
}) {
  return (
    <div>
      <StepHeader
        icon={<Building2 size={18} />}
        title="Реквизиты компании"
        hint="Подставляются в счета, акты и накладные. Обязательно только название."
      />
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Название *" value={company.name} onChange={(e) => set("name", e.target.value)} placeholder="ООО «Ромашка»" />
        </div>
        <Input label="ИНН" value={company.inn} onChange={(e) => set("inn", e.target.value)} />
        <Input label="КПП" value={company.kpp} onChange={(e) => set("kpp", e.target.value)} />
        <Input label="ОГРН" value={company.ogrn} onChange={(e) => set("ogrn", e.target.value)} />
        <Input label="ОКПО" value={company.okpo} onChange={(e) => set("okpo", e.target.value)} />
        <div className="sm:col-span-2">
          <Input label="Юридический адрес" value={company.legalAddress} onChange={(e) => set("legalAddress", e.target.value)} />
        </div>
        <Input label="Телефон" value={company.phone} onChange={(e) => set("phone", e.target.value)} />
        <Input label="Email" type="email" value={company.email} onChange={(e) => set("email", e.target.value)} />
        <Input label="Руководитель" value={company.director} onChange={(e) => set("director", e.target.value)} placeholder="Иванов И. И." />
        <Input label="Должность руководителя" value={company.directorTitle} onChange={(e) => set("directorTitle", e.target.value)} />
        <Input label="Главный бухгалтер" value={company.accountant} onChange={(e) => set("accountant", e.target.value)} />
        <div className="sm:col-span-2 mt-1 border-t border-line-soft pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Банк</p>
        </div>
        <Input label="Банк" value={company.bankName} onChange={(e) => set("bankName", e.target.value)} />
        <Input label="БИК" value={company.bankBik} onChange={(e) => set("bankBik", e.target.value)} />
        <Input label="Расчётный счёт" value={company.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
        <Input label="Корр. счёт" value={company.corrAccount} onChange={(e) => set("corrAccount", e.target.value)} />
        <label className="sm:col-span-2 mt-1 flex items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" checked={company.worksWithVat} onChange={(e) => set("worksWithVat", e.target.checked)} className="rounded border-line" />
          Работаем с НДС (появятся графы НДС и УПД)
        </label>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} loading={saving}>
          Далее <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

function AssetsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div>
      <StepHeader
        icon={<Stamp size={18} />}
        title="Печать и подпись"
        hint="Появятся на счетах и накладных. Можно пропустить и добавить позже."
      />
      <div className="space-y-3">
        <AssetUpload field="logoKey" label="Логотип" />
        <AssetUpload field="stampKey" label="Печать" />
        <AssetUpload field="signatureKey" label="Подпись" />
      </div>
      <p className="mt-3 text-xs text-fg-subtle">
        PNG или JPG. Печать и подпись лучше на прозрачном фоне (PNG).
      </p>
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} /> Назад
        </Button>
        <Button onClick={onNext}>
          Далее <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

function AssetUpload({ field, label }: { field: Asset; label: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setState("loading");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("field", field);
    const res = await fetch("/api/settings/logo", { method: "POST", body: fd }).catch(() => null);
    setState(res && res.ok ? "done" : "idle");
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-surface-sunken px-3 py-2.5">
      <span className="text-sm text-fg">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
      >
        {state === "loading" ? (
          <Loader2 size={13} className="animate-spin" />
        ) : state === "done" ? (
          <Check size={13} className="text-green-500" />
        ) : (
          <Upload size={13} />
        )}
        {state === "done" ? "Загружено" : "Загрузить"}
      </button>
    </div>
  );
}

interface StaffRow {
  name: string;
  email: string;
  role: Role;
  password: string;
}

function StaffStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [row, setRow] = useState<StaffRow>({ name: "", email: "", role: "MANAGER", password: "" });
  const [added, setAdded] = useState<{ name: string; role: Role }[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!row.name.trim() || !row.email.trim()) {
      setError("Впишите имя и email");
      return;
    }
    if (row.password.length < 10) {
      setError("Пароль — минимум 10 символов");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(typeof b?.error === "string" ? b.error : "Не удалось добавить сотрудника");
        return;
      }
      setAdded((a) => [...a, { name: row.name, role: row.role }]);
      setRow({ name: "", email: "", role: "MANAGER", password: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHeader
        icon={<Users size={18} />}
        title="Сотрудники"
        hint="Добавьте, кто будет работать в системе. Можно пропустить и завести позже."
      />
      {added.length > 0 && (
        <div className="mb-4 space-y-1">
          {added.map((u, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-sm">
              <Check size={14} className="text-green-500" />
              <span className="text-fg">{u.name}</span>
              <span className="text-xs text-fg-subtle">
                {ROLE_OPTIONS.find((r) => r.value === u.role)?.label}
              </span>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Имя" value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} />
        <Input label="Email" type="email" value={row.email} onChange={(e) => setRow({ ...row, email: e.target.value })} />
        <Select
          label="Роль"
          value={row.role}
          onChange={(e) => setRow({ ...row, role: e.target.value as Role })}
          options={ROLE_OPTIONS}
        />
        <Input
          label="Пароль"
          type="password"
          value={row.password}
          onChange={(e) => setRow({ ...row, password: e.target.value })}
          hint="Минимум 10 символов"
        />
      </div>
      <div className="mt-3">
        <Button variant="outline" onClick={add} loading={saving}>
          Добавить сотрудника
        </Button>
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} /> Назад
        </Button>
        <Button onClick={onNext}>
          Далее <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

function DoneStep({
  brandName,
  finishing,
  onFinish,
}: {
  brandName: string;
  finishing: boolean;
  onFinish: () => void;
}) {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
        <Check size={24} />
      </div>
      <h2 className="text-lg font-semibold text-fg">Готово</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
        {brandName} настроена. Реквизиты, печать и сотрудники всегда доступны в разделе
        «Настройки» — можно дополнить в любой момент.
      </p>
      <div className="mt-6">
        <Button onClick={onFinish} loading={finishing}>
          Перейти в систему <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
