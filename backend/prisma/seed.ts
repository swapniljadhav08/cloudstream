import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Seeds the two accounts the UI and the smoke test expect.
// Development only: the passwords are fixed and well known.
const prisma = new PrismaClient();

const SEED_USERS = [
  { email: 'admin@example.com', name: 'Platform Admin', password: 'AdminPass123!', role: Role.ADMIN },
  { email: 'creator@example.com', name: 'Content Creator', password: 'CreatorPass123!', role: Role.USER },
] as const;

async function main(): Promise<void> {
  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: await bcrypt.hash(user.password, 12),
        emailVerified: true,
      },
    });
    console.log(`seeded ${user.role.padEnd(11)} ${user.email}`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
