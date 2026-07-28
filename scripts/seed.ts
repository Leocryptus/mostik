/**
 * Сид: проекты, люди и настройки из паспортов волта.
 *
 *   npx tsx scripts/seed.ts
 *
 * Данные взяты из аудита 25.07 и ТЗ. Проекты заводятся кандидатами:
 * по правилу ТЗ проект не становится активным, пока не прошёл прожарку.
 */
import { db as prisma } from "../lib/db";

const PROJECTS = [
  { title: "Cryptus", legacyKey: "cryptus", potentialUsd: 10000, hellYeah: 9, owner: "Ник и Гера", forWhom: "аудитория канала", icon: "🟣" },
  { title: "MAST Finance", legacyKey: "mast", potentialUsd: 5000, hellYeah: 7, owner: "Гео и Гриша", forWhom: "партнёры", icon: "🪙" },
  { title: "Обменка", legacyKey: "exchange", potentialUsd: 5000, hellYeah: 6, owner: "Герман", forWhom: "клиенты OTC", icon: "💱" },
  { title: "Union", legacyKey: "union", potentialUsd: 5000, hellYeah: 5, owner: "Женя", forWhom: "инвесторы", icon: "📊" },
  { title: "Медиа и контент", legacyKey: "media", potentialUsd: null, hellYeah: 8, owner: null, forWhom: "аудитория", icon: "🎬" },
];

const PEOPLE = [
  { name: "Гео", role: "ассистент, развитие и инфраструктура", tone: "ровный", active: true },
  { name: "Герман", role: "обменник, сооснователь MAST", tone: "на равных", active: true },
  { name: "Гриша", role: "разработка", tone: "сухо и по делу", active: true },
  { name: "Женя", role: "Union, публичные ресурсы", tone: "ровный", active: true },
  { name: "Стас", role: "партнёрства", tone: "ровный", active: true },
  { name: "Кирилл", role: "контент (ушёл 20.07)", tone: "ровный", active: false },
];

async function main() {
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
  await prisma.moneyMonth.upsert({
    where: { month },
    update: {},
    create: { month, goalUsd: 20000 },
  });

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, dayCapacity: 180, hourRateUsd: 62, freezesPerWeek: 2 },
  });

  const [projects, people] = await Promise.all([prisma.project.count(), prisma.person.count()]);
  console.log(`Проектов: ${projects}, людей: ${people}, месяц ${month} с целью $20 000`);
  console.log("Все проекты заведены кандидатами — активными станут после прожарки");
}

main()
  .catch((e) => {
    console.error("Ошибка сида:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
