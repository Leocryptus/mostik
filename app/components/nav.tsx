import Link from "next/link";

/**
 * Три вкладки простой версии: что делаю сейчас · ради чего · что не разобрано.
 * Задача месяца — подстраница «Месяца», отдельной вкладки не заводим.
 */
export type NavKey = "today" | "month" | "inbox";

const ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: "today", href: "/", label: "Сегодня" },
  { key: "month", href: "/month", label: "Месяц" },
  { key: "inbox", href: "/inbox", label: "Инбокс" },
];

export function Nav({ active, inbox }: { active: NavKey; inbox?: number }) {
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
              color: on ? "var(--on-acc)" : "var(--muted)",
              background: on ? "var(--s-ok)" : "transparent",
              border: `1px solid ${on ? "transparent" : "var(--line)"}`,
              fontWeight: on ? 650 : 400,
            }}
          >
            {i.label}
            {i.key === "inbox" && inbox ? (
              <span className="num" style={{ marginLeft: 7, opacity: on ? 0.75 : 1, color: on ? "inherit" : "var(--s-behind)" }}>
                {inbox}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
