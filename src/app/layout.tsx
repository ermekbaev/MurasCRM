import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { getBranding } from "@/lib/branding.server";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBranding();
  return {
    title: `${brand.name} CRM`,
    description: "CRM-система для рекламно-производственного цеха",
    icons: { icon: brand.logo },
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
      <head>
        {/* Фирменный цвет установки. Пусто, когда цвет не задан, — тогда
            действует палитра из globals.css. Значения приходят из генератора
            палитры, а не из пользовательского ввода. */}
        {brand.css && <style id="brand-palette">{brand.css}</style>}
      </head>
      <body className="h-full font-sans antialiased">
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
