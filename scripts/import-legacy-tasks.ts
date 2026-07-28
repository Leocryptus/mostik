/**
 * Перенос задач из старого канона в базу мостика.
 *
 *   npx tsx scripts/import-legacy-tasks.ts            # перенос + сверка
 *   npx tsx scripts/import-legacy-tasks.ts --merge    # ещё и слить дубли
 *
 * Дубли не удаляются: побеждённая задача получает статус «заморожено»
 * и ссылку mergedInto на ту, что осталась.
 */
import { readFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { parseLegacyFile, mapLegacyTask, findDuplicates } from "../lib/legacy";
import { db as prisma } from "../lib/db";

const CANON = "/Users/leo/brain/vault/leo-os/leo-os-tasks.js";
const DB = path.resolve("prisma/dev.db");
const BACKUPS = path.resolve("backups");


function backup() {
  mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  copyFileSync(CANON, path.join(BACKUPS, `leo-os-tasks.${stamp}.js`));
  if (existsSync(DB)) copyFileSync(DB, path.join(BACKUPS, `dev.${stamp}.db`));
  console.log(`Бэкап: канон и база сохранены в backups/ (метка ${stamp})`);
}

async function main() {
  const withMerge = process.argv.includes("--merge");

  backup();

  const rows = parseLegacyFile(readFileSync(CANON, "utf8"));
  console.log(`Прочитано из канона: ${rows.length} задач`);

  const mapped = [];
  const skipped: string[] = [];
  for (const r of rows) {
    try {
      mapped.push(mapLegacyTask(r));
    } catch (e) {
      skipped.push(`${r.id}: ${(e as Error).message}`);
    }
  }

  let created = 0;
  let updated = 0;
  const rawById = new Map(rows.map((r) => [r.id, r]));
  for (const t of mapped) {
    const existing = await prisma.task.findFirst({ where: { legacyId: t.legacyId } });
    const data = {
      title: t.title,
      status: t.status,
      bucket: t.bucket,
      due: t.due,
      doneAt: t.doneAt,
      who: t.who,
      createdAt: t.createdAt ?? undefined,
      legacyId: t.legacyId,
      legacyRaw: JSON.stringify(rawById.get(t.legacyId) ?? {}),
    };
    if (existing) {
      await prisma.task.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.task.create({ data });
      created++;
    }
  }

  // ── сверка: столько же задач и те же заголовки ──
  const inDb = await prisma.task.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true, title: true } });
  const canonTitles = new Set(mapped.map((t) => `${t.legacyId}|${t.title}`));
  const dbTitles = new Set(inDb.map((t) => `${t.legacyId}|${t.title}`));
  const lost = [...canonTitles].filter((x) => !dbTitles.has(x));

  console.log(`Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped.length}`);
  if (skipped.length) skipped.forEach((s) => console.log(`  пропуск — ${s}`));
  console.log(`Сверка: в каноне ${mapped.length}, в базе ${inDb.length}, потеряно ${lost.length}`);
  if (lost.length) {
    lost.forEach((l) => console.log(`  ПОТЕРЯНА — ${l}`));
    throw new Error("Сверка не сошлась: часть задач не доехала. Ничего не удаляем, разбираемся руками.");
  }
  console.log("Сверка сошлась: ни одна задача не потеряна");

  // ── дубли ──
  const dups = findDuplicates(mapped);
  if (!dups.length) {
    console.log("Дублей по заголовку не найдено");
  } else {
    console.log(`\nДубли (${dups.length}):`);
    for (const d of dups) console.log(`  ${d.merge.legacyId} → ${d.keep.legacyId} · «${d.keep.title}»`);
    if (!withMerge) {
      console.log("Это разбор без изменений. Чтобы слить, запусти с --merge");
    } else {
      for (const d of dups) {
        const keep = await prisma.task.findFirst({ where: { legacyId: d.keep.legacyId } });
        const merge = await prisma.task.findFirst({ where: { legacyId: d.merge.legacyId } });
        if (keep && merge && merge.status !== "frozen") {
          await prisma.task.update({
            where: { id: merge.id },
            data: { status: "frozen", mergedInto: keep.id },
          });
        }
      }
      console.log(`Слито: ${dups.length}. Ничего не удалено — побеждённые помечены как замороженные`);
    }
  }

  const total = await prisma.task.count();
  const byStatus = await prisma.task.groupBy({ by: ["status"], _count: true });
  console.log(`\nВ базе всего задач: ${total}`);
  byStatus.forEach((s) => console.log(`  ${s.status}: ${s._count}`));
}

main()
  .catch((e) => {
    console.error("Ошибка переноса:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
