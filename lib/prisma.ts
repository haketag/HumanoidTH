import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { supabasePoolerCa } from "./supabase-pooler-ca";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Prisma.");
  }

  const url = new URL(connectionString);
  let adapter: PrismaPg;
  if (
    url.hostname.endsWith(".pooler.supabase.com") &&
    url.port === "6543" &&
    url.searchParams.get("sslmode") === "verify-full" &&
    !url.searchParams.has("sslrootcert")
  ) {
    // pg replaces explicit TLS options when sslmode is present in the URL.
    url.searchParams.delete("sslmode");
    adapter = new PrismaPg({
      connectionString: url.toString(),
      ssl: { ca: supabasePoolerCa, rejectUnauthorized: true }
    });
  } else {
    adapter = new PrismaPg(connectionString);
  }

  const client = new PrismaClient({
    adapter,
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
