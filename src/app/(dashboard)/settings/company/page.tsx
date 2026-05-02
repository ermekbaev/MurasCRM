"use client";

import { useState, useEffect, useRef } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Building2, CreditCard, Phone, Check, ImagePlus } from "lucide-react";

interface Settings {
  name: string; inn: string; kpp: string; ogrn: string;
  legalAddress: string; phone: string; email: string; website: string;
  bankName: string; bankAccount: string; bankBik: string; corrAccount: string;
  director: string; accountant: string;
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

export default function CompanySettingsPage() {
  const [form, setForm] = useState<Settings>({
    name: "", inn: "", kpp: "", ogrn: "", legalAddress: "",
    phone: "", email: "", website: "", bankName: "", bankAccount: "",
    bankBik: "", corrAccount: "", director: "", accountant: "",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [brandingUrls, setBrandingUrls] = useState<Record<BrandingField, string | null>>({
    logoKey: null, stampKey: null, signatureKey: null,
  });
  const [uploading, setUploading] = useState<BrandingField | null>(null);
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

  function update(key: keyof Settings, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setLoading(false);
  }

  if (fetching) return <div className="p-6 text-gray-400 dark:text-slate-500">Загрузка...</div>;

  const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <Card padding="md">
      <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-4 flex items-center gap-2">{icon}{title}</h2>
      <div className="space-y-4">{children}</div>
    </Card>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Реквизиты компании</h1>
        <Button onClick={handleSave} loading={loading}>
          {saved ? <><Check size={15} /> Сохранено</> : "Сохранить"}
        </Button>
      </div>

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

        <Section title="Ответственные лица" icon={<Building2 size={16} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Руководитель (ФИО)" value={form.director} onChange={(e) => update("director", e.target.value)} placeholder="Иванов Иван Иванович" />
            <Input label="Главный бухгалтер (ФИО)" value={form.accountant} onChange={(e) => update("accountant", e.target.value)} placeholder="Петрова Мария Ивановна" />
          </div>
        </Section>

        <Section title="Брендинг для документов (PDF)" icon={<ImagePlus size={16} />}>
          <p className="text-xs text-gray-500 dark:text-slate-400 -mt-2">Используются в PDF-версиях счетов и актов.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {BRANDING.map((item) => {
              const url = brandingUrls[item.field];
              const isUploading = uploading === item.field;
              return (
                <div key={item.field} className="flex flex-col gap-2 justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{item.label}</p>
                  <div className={`${item.size} border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-slate-800/50 overflow-hidden`}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={item.label} className="max-w-full max-h-full object-contain p-2" />
                    ) : (
                      <ImagePlus size={20} className="text-gray-300" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept={item.accept}
                    className="hidden"
                    ref={(el) => { inputRefs.current[item.field] = el; }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrandingUpload(item.field, f); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    loading={isUploading}
                    onClick={() => inputRefs.current[item.field]?.click()}
                  >
                    {url ? "Заменить" : "Загрузить"}
                  </Button>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </Section>
      </form>
    </div>
  );
}
