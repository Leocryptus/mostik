import Link from "next/link";

/**
 * Вкладки в порядке приближения: сейчас → сегодня → неделя → месяц → склад проектов.
 * На главном — решения, на вкладках — работа (ТЗ §19.5).
 */
export type NavKey = "main" | "day" | "week" | "month" | "projects";

const ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: "main", href: "/", label: "Главный" },
  { key: "day", href: "/day", label: "День" },
  { key: "week", href: "/week", label: "Неделя" },
  { key: "month", href: "/month", label: "Месяц" },
  { key: "projects", href: "/projects", label: "Проекты" },
];

export function Nav({ active }: { active: NavKey }) {
  return (
    <nav style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
      {ITEMS.map((i) => {
        const on = i.key === active;
        return (
          <Link
            key={i.key}
            href={i.href}
            style={{
              fontSize: 13,
              padding: "7px 14px",
              borderRadius: 10,
              textDecoration: "none",
              color: on ? "#04161c" : "var(--muted)",
              background: on ? "var(--s-ok)" : "transparent",
              border: `1px solid ${on ? "transparent" : "var(--line)"}`,
              fontWeight: on ? 650 : 400,
            }}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
