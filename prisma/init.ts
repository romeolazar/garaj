import { prisma } from "../src/lib/prisma";
import { ensureCostCategories } from "../src/lib/cost-categories";

async function main() {
  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });
  await ensureCostCategories();
}

main()
  .then(() => console.log("[init] Application defaults are ready."))
  .finally(async () => {
    await prisma.$disconnect();
  });
