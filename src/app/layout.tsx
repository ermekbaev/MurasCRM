import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { getBranding, DEFAULT_BRAND } from "@/lib/branding.server";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBranding();
  return {
    title: `${brand.name} CRM`,
    description: "CRM-система для рекламно-производственного цеха",
    // Не логотип: у большинства он — вытянутая надпись, а во вкладке нужен
    // квадрат. Значок рисуется из цвета и первой буквы названия.
    icons: { icon: brand.configured ? "/api/branding/favicon" : DEFAULT_BRAND.logo },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brand = await getBranding();

  return (
    <html
      lang="ru"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full font-sans antialiased">
        {/* Фирменный цвет установки. Свой тег head здесь не ставим: корневой
            layout задаёт только html и body, а в head Next сам кладёт ссылку на
            стили — ручной head её вытесняет, и страница приезжает голой.
            Значения приходят из генератора палитры, а не из ввода. */}
        {brand.css && <style id="brand-palette">{brand.css}</style>}
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
