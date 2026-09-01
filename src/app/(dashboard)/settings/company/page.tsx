"use client";

import { useState, useEffect, useRef } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AdditionalCompanies from "./AdditionalCompanies";
import PageHeader from "@/components/layout/PageHeader";
import { Building2, CreditCard, Phone, Check, ImagePlus, Trash2, Percent } from "lucide-react";

interface Settings {
  name: string; inn: string; kpp: string; ogrn: string;
  legalAddress: string; phone: string; email: string; website: string;
  bankName: string; bankAccount: string; bankBik: string; corrAccount: string;
  director: string; accountant: string;
  worksWithVat: boolean; defaultVatRate: number;
  logoUrl?: string | null;
  stampUrl?: string | null;
  signatureUrl?: string | null;
}

type BrandingField = "logoKey" | "stampKey" | "signatureKey";

interface BrandingItem {
  field: BrandingField;
  label: string;
  hint: string;
  urlKey: keyof Settings;
  size: string;
  accept: string;
}

const BRANDING: BrandingItem[] = [
  { field: "logoKey",      label: "Логотип",  hint: "PNG, SVG. Рекомендуется 300×100px.",   urlKey: "logoUrl",      size: "w-full h-24", accept: "image/png,image/svg+xml,image/jpeg,image/webp" },
  { field: "stampKey",     label: "Печать",   hint: "PNG с прозрачным фоном. 500×500px.",   urlKey: "stampUrl",     size: "w-full h-24", accept: "image/png,image/jpeg,image/webp" },
  { field: "signatureKey", label: "Подпись",  hint: "PNG с прозрачным фоном. 400×150px.",   urlKey: "signatureUrl", size: "w-full h-24", accept: "image/png,image/jpeg,image/webp" },
];

const FIELD_LABELS: Record<string, string> = {
  name: "Название организации", inn: "ИНН", kpp: "КПП", ogrn: "ОГРН",
  legalAddress: "Юридический адрес", phone: "Телефон", email: "Email",
  website: "Сайт", bankName: "Банк", bankAccount: "Расчётный счёт",
  bankBik: "БИК", corrAccount: "Корр. счёт",
  director: "Директор", accountant: "Бухгалтер",
  worksWithVat: "Работа с НДС", defaultVatRate: "Ставка НДС",
};

// Defined at module scope — if declared inside the page component it would be a new
// function identity on every render, remounting its inputs and losing focus after one keystroke.
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card padding="md">
      <h2 className="font-semibold text-fg mb-4 flex items-center gap-2">{icon}{title}</h2>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

export default function CompanySettingsPage() {
  const [form, setForm] = useState<Settings>({
    name: "", inn: "", kpp: "", ogrn: "", legalAddress: "",
    phone: "", email: "", website: "", bankName: "", bankAccount: "",
    bankBik: "", corrAccount: "", director: "", accountant: "",
    worksWithVat: false, defaultVatRate: 20,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [brandingUrls, setBrandingUrls] = useState<Record<BrandingField, string | null>>({
    logoKey: null, stampKey: null, signatureKey: null,
  });
  const [uploading, setUploading] = useState<BrandingField | null>(null);
  const [deleting, setDeleting] = useState<BrandingField | null>(null);
  const inputRefs = useRef<Record<BrandingField, HTMLInputElement | null>>({
    logoKey: null, stampKey: null, signatureKey: null,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setForm((prev) => ({ ...prev, ...data }));
        setBrandingUrls({
          logoKey:      data.logoUrl      ?? null,
          stampKey:     data.stampUrl     ?? null,
          signatureKey: data.signatureUrl ?? null,
        });
        setFetching(false);
      });
  }, []);

  async function handleBrandingUpload(field: BrandingField, file: File) {
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("field", field);
      const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setBrandingUrls((prev) => ({ ...prev, [field]: url || URL.createObjectURL(file) }));
    } finally {
      setUploading(null);
      const ref = inputRefs.current[field];
      if (ref) ref.value = "";
    }
  }

  async function handleBrandingDelete(field: BrandingField, label: string) {
    if (!confirm(`Удалить «${label}»?`)) return;
    setDeleting(field);
    try {
      const res = await fetch(`/api/settings/logo?field=${field}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setBrandingUrls((prev) => ({ ...prev, [field]: null }));
    } finally {
      setDeleting(null);
    }
  }

  function update(key: keyof Settings, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateVat<K extends "worksWithVat" | "defaultVatRate">(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        return;
      }
      // Раньше провал сохранения проходил молча: кнопка гасла, реквизиты
      // оставались незаписанными, а в счёте оказывались пустые поля.
      const body = await res.json().catch(() => null);
      const fieldErrors = body?.error?.fieldErrors as Record<string, string[]> | undefined;
      const firstField = fieldErrors && Object.keys(fieldErrors)[0];
      setError(
        firstField
          ? `Не сохранено: поле «${FIELD_LABELS[firstField] ?? firstField}» заполнено неверно`
          : res.status === 403
            ? "Недостаточно прав: реквизиты меняет администратор"
            : "Не удалось сохранить реквизиты",
      );
    } catch {
      setError("Нет связи с сервером — реквизиты не сохранены");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Building2 size={18} />}
        title="Реквизиты компании"
        subtitle="Используются в счетах, актах и печатных формах"
        actions={
          <Button onClick={handleSave} loading={loading}>
            {saved ? <><Check size={15} /> Сохранено</> : "Сохранить"}
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <Section title="Основная информация" icon={<Building2 size={16} />}>
          <Input label="Название организации" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="ООО «МурасПринт»" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="ИНН" value={form.inn} onChange={(e) => update("inn", e.target.value)} />
            <Input label="КПП" value={form.kpp} onChange={(e) => update("kpp", e.target.value)} />
            <Input label="ОГРН" value={form.ogrn} onChange={(e) => update("ogrn", e.target.value)} />
          </div>
          <Input label="Юридический адрес" value={form.legalAddress} onChange={(e) => update("legalAddress", e.target.value)} />
        </Section>

        <Section title="Контактные данные" icon={<Phone size={16} />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Телефон" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            <Input label="Сайт" value={form.website} onChange={(e) => update("website", e.target.value)} />
          </div>
        </Section>

        <Section title="Банковские реквизиты" icon={<CreditCard size={16} />}>
          <Input label="Наименование банка" value={form.bankName} onChange={(e) => update("bankName", e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Расчётный счёт" value={form.bankAccount} onChange={(e) => update("bankAccount", e.target.value)} />
            <Input label="БИК" value={form.bankBik} onChange={(e) => update("bankBik", e.target.value)} />
            <Input label="Корр. счёт" value={form.corrAccount} onChange={(e) => update("corrAccount", e.target.value)} />
          </div>
        </Section>

        <Section title="Налогообложение" icon={<Percent size={16} />}>
          <label className="flex items-start gap-2.5 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.worksWithVat}
              onChange={(e) => updateVat("worksWithVat", e.target.checked)}
              className="mt-0.5 rounded border-line"
            />
            <span>
              Работаем с НДС
              <span className="mt-0.5 block text-xs text-fg-subtle">
                Выключено — поля и строки НДС не показываются в счетах. Включите,
                если выставляете счета-фактуры.
              </span>
            </span>
          </label>

          {form.worksWithVat && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Ставка НДС по умолчанию, %"
                type="number"
                min={0}
                max={100}
                value={form.defaultVatRate}
                onChange={(e) => updateVat("defaultVatRate", Number(e.target.value))}
                hint="Подставляется в новые счета, в самом счёте её можно изменить"
              />
            </div>
          )}
        </Section>

        <Section title="Ответственные лица" icon={<Building2 size={16} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Руководитель (ФИО)" value={form.director} onChange={(e) => update("director", e.target.value)} placeholder="Иванов Иван Иванович" />
            <Input label="Главный бухгалтер (ФИО)" value={form.accountant} onChange={(e) => update("accountant", e.target.value)} placeholder="Петрова Мария Ивановна" />
          </div>
        </Section>

        <Section title="Брендинг для документов (PDF)" icon={<ImagePlus size={16} />}>
          <p className="text-xs text-fg-muted -mt-2">Используются в PDF-версиях счетов и актов.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {BRANDING.map((item) => {
              const url = brandingUrls[item.field];
              const isUploading = uploading === item.field;
              const isDeleting = deleting === item.field;
              return (
                <div key={item.field} className="flex flex-col gap-2 justify-between">
                  <p className="text-sm font-medium text-fg-muted">{item.label}</p>
                  <div className={`${item.size} border-2 border-dashed border-line rounded-lg flex items-center justify-center bg-surface-sunken overflow-hidden`}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={item.label} className="max-w-full max-h-full object-contain p-2" />
                    ) : (
                      <ImagePlus size={20} className="text-fg-subtle" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept={item.accept}
                    className="hidden"
                    ref={(el) => { inputRefs.current[item.field] = el; }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrandingUpload(item.field, f); }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      loading={isUploading}
                      onClick={() => inputRefs.current[item.field]?.click()}
                      className="flex-1"
                    >
                      {url ? "Заменить" : "Загрузить"}
                    </Button>
                    {url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={`Удалить «${item.label}»`}
                        aria-label={`Удалить «${item.label}»`}
                        loading={isDeleting}
                        onClick={() => handleBrandingDelete(item.field, item.label)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                      >
                        {!isDeleting && <Trash2 size={16} />}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-fg-subtle">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </Section>
      </form>

      <AdditionalCompanies />
    </div>
  );
}
