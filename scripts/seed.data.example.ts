/**
 * Пример данных для сида. Настоящие проекты, люди и суммы лежат рядом
 * в `seed.data.local.ts` — этот файл не попадает в репозиторий.
 *
 * Скопируй этот файл в seed.data.local.ts и заполни своими данными.
 */

export interface SeedProject {
  title: string;
  legacyKey: string;
  potentialUsd: number | null;
  hellYeah: number;
  owner: string | null;
  forWhom: string | null;
  icon: string;
}

export interface SeedPerson {
  name: string;
  role: string;
  tone: string; // ровный | на равных | сухо и по делу
  active: boolean;
}

export const PROJECTS: SeedProject[] = [
  { title: "Первый проект", legacyKey: "one", potentialUsd: 10000, hellYeah: 9, owner: "Владелец", forWhom: "аудитория", icon: "🟣" },
  { title: "Второй проект", legacyKey: "two", potentialUsd: 5000, hellYeah: 7, owner: "Владелец", forWhom: "партнёры", icon: "🪙" },
  { title: "Проект без цифры", legacyKey: "three", potentialUsd: null, hellYeah: 8, owner: null, forWhom: "аудитория", icon: "🎬" },
];

export const PEOPLE: SeedPerson[] = [
  { name: "Коллега", role: "развитие", tone: "ровный", active: true },
  { name: "Партнёр", role: "направление", tone: "на равных", active: true },
  { name: "Подрядчик", role: "разработка", tone: "сухо и по делу", active: true },
];

export const MONTH_GOAL_USD = 20000;
export const HOUR_RATE_USD = 62;
