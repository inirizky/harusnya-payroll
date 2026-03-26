import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Mapping old statuses to new statuses...');

  // Map REVIEWED to APPROVED
  await prisma.slipGaji.updateMany({
    where: { status: 'REVIEWED' as any },
    data: { status: 'APPROVED' as any },
  });

  // Map NEED_CONFIRMATION to SENT
  await prisma.slipGaji.updateMany({
    where: { status: 'NEED_CONFIRMATION' as any },
    data: { status: 'SENT' as any },
  });

  // Old PENDING probably meant approved by employee but not paid.
  // We can map it to CONFIRMED or PROCESSED. Let's map to PROCESSED.
  await prisma.slipGaji.updateMany({
    where: { status: 'PENDING' as any },
    data: { status: 'PROCESSED' as any },
  });

  // REVIEW, PAID, and DISPUTED remain the same name so they don't need migration logic yet.

  console.log('Finished status migration.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
