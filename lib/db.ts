/**
 * Единая точка подключения к базе. Prisma 7 требует адаптер драйвера,
 * поэтому клиент создаётся только здесь — не плодим подключения по файлам.
 *
 * В разработке Next перезапускает модули на каждом изменении, поэтому клиент
 * держим на globalThis, иначе накопятся десятки открытых соединений.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

function create() {
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const g = globalThis as unknown as { __mostikPrisma?: ReturnType<typeof create> };

export const db = g.__mostikPrisma ?? create();

if (process.env.NODE_ENV !== "production") g.__mostikPrisma = db;
