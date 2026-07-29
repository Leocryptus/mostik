import Link from "next/link";

/** Вкладки. На главном — решения, на вкладках — работа (ТЗ §19). */
export function Nav({ active }: { active: "main" | "day" | "projects" }) {
  const items = [
    { key: "main", href: "/", label: "Главный" },
    { key: "day", href: "/inbox", label: "День" },
    { key: "projects", href: "/projects", label: "Проекты" },
  ] as const;

  return (
    <nav style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
      {items.map((i) => {
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
