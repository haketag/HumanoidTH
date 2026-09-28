import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Prisma.");
  }

  const client = new PrismaClient({
    adapter: new PrismaPg(connectionString),
    log: process.env.PRISMA_LOG_LEVEL === "silent" ? [] : process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

  globalForPrisma.prisma = client;
  return client;
}

// Delay reading DATABASE_URL and constructing Prisma until a query is made.
// Next.js imports route and page modules during build-time page data collection.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  }
});
