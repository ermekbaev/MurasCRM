"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Mail, Lock, LogIn, Loader2 } from "lucide-react";
import LoginArt from "@/components/shared/LoginArt";
import BrandImage from "@/components/shared/BrandImage";

/** Бренд приходит сверху: страница входа — первое, что видит клиент. */
export default function LoginForm({
  brand,
}: {
  brand: { name: string; tagline: string; logo: string };
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [wideLogo, setWideLogo] = useState(false);

  // Пропорции меряем по самой картинке: у одних клиентов знак квадратный,
  // у других — длинная плашка с названием.
  const measureLogo = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalHeight > 0) setWideLogo(img.naturalWidth / img.naturalHeight > 1.6);
  };

  // Трекинг захода в демо по метке ?ref= (какой заказчик открыл ссылку).
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref) return;
    const key = "demo-visit-" + ref;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/demo-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Неверный email или пароль");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    // Страница входа всегда светлая, даже если система просит тёмную тему: оттенки акцента считаем от цвета клиента
    <div
      className="fixed inset-0 overflow-auto bg-[#f6f5fb]"
      style={
        {
          "--accent-soft": "color-mix(in srgb, var(--accent) 9%, white)",
          "--accent-soft-strong": "color-mix(in srgb, var(--accent) 22%, white)",
          "--accent-on-soft": "var(--accent-hover)",
        } as React.CSSProperties
      }
    >
      {/* Фон: мягкие пятна акцента клиента, как в рабочем пространстве (22.11) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -bottom-32 right-[-6rem] h-[32rem] w-[32rem] rounded-full bg-[#ffd9c7]/60 blur-3xl" />
        <div className="absolute right-1/3 top-1/4 h-80 w-80 rounded-full bg-[#cfeaf0]/60 blur-3xl" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.5]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="var(--accent)" opacity="0.18" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto grid min-h-full max-w-[1520px] items-center gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_34rem] lg:gap-20 lg:px-16 xl:grid-cols-[minmax(0,1fr)_36rem]">
        {/* Левая часть: смысл и картинка (на телефоне скрыта) */}
        <section className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <BrandImage src={brand.logo} alt={brand.name} width={40} height={40} unoptimized className="h-10 w-10 object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-bold uppercase tracking-wide text-slate-800">{brand.name}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{brand.tagline}</div>
            </div>
          </div>
          <h2 className="text-[48px] font-semibold leading-[1.08] tracking-tight text-slate-900">
            От заявки
            <br />
            до готового заказа.
          </h2>
          <p className="mt-5 max-w-lg text-lg text-slate-600">Клиенты, производство и склад. Все этапы связаны, всё под контролем.</p>
          <div className="mt-10">
            <LoginArt />
          </div>
        </section>

      {/* Карточка */}
      <div className="w-full max-w-xl justify-self-center lg:justify-self-end">
        <div className="overflow-hidden rounded-[28px] bg-white/95 shadow-[0_40px_100px_-36px_rgb(16_20_28/0.4)] ring-1 ring-white">
          {/* Шапка: на телефоне знак и название (слева их там нет), на компьютере только заголовок */}
          <div className="px-6 pb-2 pt-8 sm:px-12 sm:pt-12">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <BrandImage
                src={brand.logo}
                alt={brand.name}
                width={wideLogo ? 200 : 40}
                height={40}
                onLoad={measureLogo}
                className={wideLogo ? "h-10 w-auto max-w-[200px] object-contain object-left" : "h-10 w-10 object-contain"}
                unoptimized
                priority
              />
              {!wideLogo && (
                <div className="leading-tight">
                  <div className="text-base font-bold text-slate-800">{brand.name}</div>
                  <div className="text-xs text-slate-500">{brand.tagline}</div>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500">С возвращением</p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[32px]">Вход в систему</h1>
            <p className="mt-2 text-[15px] text-slate-500">Введите почту и пароль, чтобы продолжить работу.</p>
          </div>

          {/* Форма */}
          <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-8 pt-6 sm:px-12 sm:pb-12">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3.5 pl-11 text-base border border-slate-200 rounded-lg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all bg-white text-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed placeholder:text-slate-400"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              </div>
            </div>

            {/* Пароль */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Пароль
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value.replace(/\s/g, ""))
                  }
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData
                      .getData("text")
                      .replace(/\s/g, "");
                    setPassword(pasted);
                  }}
                  disabled={loading}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3.5 pl-11 pr-11 text-base border border-slate-200 rounded-lg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 transition-all bg-white text-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed placeholder:text-slate-400"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Ошибка */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Кнопка */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-2 flex w-full items-center justify-center gap-2 py-3.5 text-base bg-accent hover:bg-accent-hover active:bg-accent-active text-on-accent text-sm font-medium rounded-lg shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Входим...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Войти</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {brand.name}
        </p>
      </div>
      </div>
    </div>
  );
}
