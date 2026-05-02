"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Mail, Lock, LogIn, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      {/* Фон */}
      <div className="absolute inset-0 bg-slate-900" />

      {/* Декоративные элементы */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-800/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] bg-slate-700/25 rounded-full blur-3xl" />
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.05]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="white"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Карточка */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Шапка */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-10 h-10">
                <Image
                  src="/logo.svg"
                  alt="МурасПринт"
                  width={40}
                  height={40}
                  priority
                />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-800 leading-tight">
                  МурасПринт
                </h1>
                <p className="text-xs text-slate-500">CRM-система</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-1.5">
              <LogIn className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-violet-700 text-xs font-medium">
                Вход в систему
              </span>
            </div>
          </div>

          {/* Форма */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
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
                  placeholder="admin@muras.com"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-2.5 pl-10 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all bg-white text-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed placeholder:text-slate-400"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                  className="w-full px-4 py-2.5 pl-10 pr-10 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all disabled:bg-slate-50 disabled:cursor-not-allowed placeholder:text-slate-400"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-medium rounded-lg shadow-lg shadow-violet-600/25 hover:shadow-xl hover:shadow-violet-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg mt-1"
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

        <p className="text-center text-slate-600 text-xs mt-4">
          © 2026 МурасПринт
        </p>
      </div>
    </div>
  );
}
