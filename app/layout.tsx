import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мостик",
  description: "Личная ОС: проекты месяца, день, команда и штаб агентов",
};

export const viewport = {
  themeColor: "#070c12",
  width: "device-width",
  initialScale: 1,
};

/**
 * Шрифты берём системные (Helvetica Neue / SF на маке) — канон ТЗ §18.
 * Google-шрифты не подключаем: лишняя зависимость от сети при сборке и в рантайме.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
