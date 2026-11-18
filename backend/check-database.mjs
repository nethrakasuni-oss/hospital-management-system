import { PrismaClient } from "./src/generated/prisma/client.js";

const prisma = new PrismaClient();

try {
  const tables = await prisma.$queryRaw`
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  console.table(tables);

  const roles = await prisma.$queryRaw`
    SELECT *
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND LOWER(table_name) = 'role'
  `;

  console.log("ROLE TABLE CHECK:");
  console.table(roles);

} catch (error) {
  console.error(error);
} finally {
  await prisma.$disconnect();
}
