import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const [missingFlows, invalidPipelineCounts, headerOnlyFlows] =
    await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS "count"
        FROM "container_record" AS container
        LEFT JOIN "flow_instance" AS flow
          ON flow."container_id" = container."id"
        WHERE NULLIF(BTRIM(container."container_number"), '') IS NOT NULL
          AND flow."id" IS NULL
      `,
      prisma.$queryRaw<
        Array<{ flowInstanceId: string; nodeCount: bigint; taskCount: bigint }>
      >`
        SELECT
          flow."id" AS "flowInstanceId",
          count(DISTINCT node."id")::bigint AS "nodeCount",
          count(DISTINCT task."id")::bigint AS "taskCount"
        FROM "flow_instance" AS flow
        LEFT JOIN "node_instance" AS node
          ON node."flow_instance_id" = flow."id"
        LEFT JOIN "node_task" AS task
          ON task."node_instance_id" = node."id"
        GROUP BY flow."id"
        HAVING count(DISTINCT node."id") <> 14
          OR count(DISTINCT task."id") <> 14
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS "count"
        FROM "container_record" AS container
        JOIN "flow_instance" AS flow
          ON flow."container_id" = container."id"
        WHERE NULLIF(BTRIM(container."container_number"), '') IS NULL
      `,
    ]);

  const missingFlowCount = missingFlows[0]?.count ?? 0n;
  const headerOnlyFlowCount = headerOnlyFlows[0]?.count ?? 0n;
  if (
    missingFlowCount !== 0n ||
    invalidPipelineCounts.length > 0 ||
    headerOnlyFlowCount !== 0n
  ) {
    throw new Error(
      `Pipeline task pool invalid: missingFlows=${missingFlowCount}, invalidPipelines=${invalidPipelineCounts.length}, headerOnlyFlows=${headerOnlyFlowCount}`,
    );
  }

  const flowCount = await prisma.flowInstance.count();
  console.log(`Pipeline task pool verified: ${flowCount} flows`);
} finally {
  await prisma.$disconnect();
}
