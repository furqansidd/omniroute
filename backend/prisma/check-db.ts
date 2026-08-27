import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOwners() {
  console.log('🔍 Checking Database for Registered Tenants and Users...\n');
  
  const tenants = await prisma.tenant.findMany({
    include: {
      users: {
        include: {
          role: true
        }
      }
    }
  });

  console.log(`Found ${tenants.length} Tenant(s) in Database:\n`);

  for (const tenant of tenants) {
    console.log(`========================================`);
    console.log(`Tenant ID: ${tenant.id}`);
    console.log(`Company Name: ${tenant.companyName}`);
    console.log(`Industry: ${tenant.industryType} | Tier: ${tenant.subscriptionTier} | Status: ${tenant.status}`);
    console.log(`Users: (${tenant.users.length})`);
    
    for (const u of tenant.users) {
      console.log(`  - Name: ${u.name}`);
      console.log(`    Email: ${u.email}`);
      console.log(`    Phone: ${u.phone}`);
      console.log(`    Role: ${u.role?.name}`);
      console.log(`    Status: ${u.status}`);
    }
    console.log(`========================================\n`);
  }
}

checkOwners()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
