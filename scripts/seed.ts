/**
 * Сид: проекты, люди и настройки.
 *
 *   npx tsx scripts/seed.ts
 *
 * Данные берутся из scripts/seed.data.local.ts (он не в репозитории).
 * Если его нет — из seed.data.example.ts, чтобы проект поднимался у любого.
 * Проекты заводятся кандидатами: по правилу ТЗ проект не становится активным,
 * пока не прошёл прожарку.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { db as prisma } from "../lib/db";

async function loadData() {
  const local = path.resolve("scripts/seed.data.local.ts");
  return existsSync(local) ? await import("./seed.data.local") : await import("./seed.data.example");
}

async function main() {
  const { PROJECTS, PEOPLE, MONTH_GOAL_USD, HOUR_RATE_USD } = await loadData();

  for (const p of PROJECTS) {
    const existing = await prisma.project.findFirst({ where: { legacyKey: p.legacyKey } });
    if (existing) {
      await prisma.project.update({ where: { id: existing.id }, data: p });
    } else {
      await prisma.project.create({ data: { ...p, status: "candidate" } });
    }
  }

  for (const p of PEOPLE) {
    await prisma.person.upsert({ where: { name: p.name }, update: p, create: p });
  }

  const month = new Date().toISOString().slice(0, 7);
  await prisma.moneyMonth.upsert({ where: { month }, update: {}, create: { month, goalUsd: MONTH_GOAL_USD } });
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, dayCapacity: 180, hourRateUsd: HOUR_RATE_USD, freezesPerWeek: 2 },
  });

  const [projects, people] = await Promise.all([prisma.project.count(), prisma.person.count()]);
  console.log(`Проектов: ${projects}, людей: ${people}, месяц ${month} с целью $${MONTH_GOAL_USD.toLocaleString("ru-RU")}`);
  console.log("Все проекты заведены кандидатами — активными станут после прожарки");
}

main()
  .catch((e) => {
    console.error("Ошибка сида:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
