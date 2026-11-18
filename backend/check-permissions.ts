import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './src/generated/prisma/client.ts'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })

async function main() {
  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
    orderBy: { id: 'asc' },
  })

  const permissions = await prisma.permission.findMany({
    orderBy: { id: 'asc' },
  })

  console.log('\n===== ALL PERMISSIONS =====')
  console.table(permissions.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
  })))

  console.log('\n===== ROLE PERMISSION ASSIGNMENTS =====')

  for (const role of roles) {
    console.log(`\nROLE: ${role.name} (ID: ${role.id})`)

    console.table(
      role.rolePermissions.map(rp => ({
        permissionId: rp.permissionId,
        permission: rp.permission.name,
      }))
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
