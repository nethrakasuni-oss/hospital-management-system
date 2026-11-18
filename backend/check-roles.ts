import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!
});

const prisma = new PrismaClient({ adapter });

try {
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true
    },
    orderBy: { id: "asc" }
  });

  console.log("===== EXISTING MEDICORE STAFF ROLES =====");
  console.table(roles);

} catch (error) {
  console.error(error);
} finally {
  await prisma.$disconnect();
}
