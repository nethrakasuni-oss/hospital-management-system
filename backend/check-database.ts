import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!
});

const prisma = new PrismaClient({ adapter });

try {
  console.log("===== DATABASE TABLES =====");

  const tables = await prisma.$queryRaw`
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  console.table(tables);

  console.log("===== ROLE TABLE CHECK =====");

  const roles = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND LOWER(table_name) LIKE '%role%'
  `;

  console.table(roles);

} catch (error) {
  console.error(error);
} finally {
  await prisma.$disconnect();
}
