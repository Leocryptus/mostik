/**
 * Экспорт задач из базы мостика обратно в старый канон.
 *
 *   npx tsx scripts/export-canon.ts          # проверка: собрать и сравнить, файл не трогать
 *   npx tsx scripts/export-canon.ts --write  # записать файл (с бэкапом)
 *
 * Файл читают дашборд :8765, бот и дайджест — поэтому запись атомарная
 * (пишем во временный файл и подменяем), чтобы никто не поймал половину.
 */
import { readFileSync, writeFileSync, renameSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { db as prisma } from "../lib/db";
import { buildCanonRecord, renderCanonFile } from "../lib/canon-export";
import { parseLegacyFile } from "../lib/legacy";

const CANON = "/Users/leo/brain/vault/leo-os/leo-os-tasks.js";
const BACKUPS = path.resolve("backups");

async function main() {
  const write = process.argv.includes("--write");

  const tasks = await prisma.task.findMany({
    orderBy: [{ legacyId: "asc" }, { createdAt: "asc" }],
    select: { legacyId: true, legacyRaw: true, title: true, status: true, bucket: true, due: true, doneAt: true, who: true },
  });

  const content = renderCanonFile(tasks.map(buildCanonRecord));

  // ── сверка с тем, что лежит сейчас ──
  const current = parseLegacyFile(readFileSync(CANON, "utf8"));
  const next = parseLegacyFile(content);
  const curIds = new Set(current.map((r) => r.id));
  const nextIds = new Set(next.map((r) => r.id));
  const lost = [...curIds].filter((id) => !nextIds.has(id));
  const added = [...nextIds].filter((id) => !curIds.has(id));

  console.log(`Сейчас в файле: ${current.length} · соберём: ${next.length}`);
  console.log(`Пропадёт: ${lost.length}${lost.length ? " → " + lost.join(", ") : ""}`);
  console.log(`Появится: ${added.length}${added.length ? " → " + added.join(", ") : ""}`);

  if (lost.length) {
    throw new Error("Экспорт потерял бы задачи — файл не трогаем, разбираемся руками");
  }

  // построчная сверка ключевых полей: не молча ли меняем чужие данные
  const curById = new Map(current.map((r) => [r.id, r]));
  const changed: string[] = [];
  for (const r of next) {
    const c = curById.get(r.id);
    if (!c) continue;
    for (const k of ["text", "done", "status", "bucket", "topic"] as const) {
      if (JSON.stringify(c[k] ?? null) !== JSON.stringify(r[k] ?? null)) {
        changed.push(`${r.id}.${k}: ${JSON.stringify(c[k] ?? null)} → ${JSON.stringify(r[k] ?? null)}`);
      }
    }
  }
  console.log(`Изменится полей: ${changed.length}`);
  changed.slice(0, 20).forEach((c) => console.log(`  ${c}`));
  if (changed.length > 20) console.log(`  … и ещё ${changed.length - 20}`);

  if (!write) {
    console.log("Это проверка. Чтобы записать файл, запусти с --write");
    return;
  }

  mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  copyFileSync(CANON, path.join(BACKUPS, `leo-os-tasks.before-export.${stamp}.js`));

  const tmp = `${CANON}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, CANON); // подмена одним движением — читатели не увидят половину файла
  console.log(`Файл записан: ${CANON} (бэкап в backups/)`);
}

main()
  .catch((e) => {
    console.error("Ошибка экспорта:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
