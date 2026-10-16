/** DateTime lagras i UTC; rå SQL mot now() kräver att sessionen också kör UTC. */
import { afterAll, expect, it } from "vitest";
import { db } from "../src";

afterAll(() => db.$disconnect());

it("databasens sessionstidszon är UTC för appens roll", async () => {
  const [row] = await db.$queryRaw<{ TimeZone: string }[]>`SHOW timezone`;
  expect(row!.TimeZone).toBe("UTC");
  const [cmp] = await db.$queryRaw<{ diff: number }[]>`SELECT abs(extract(epoch FROM (now()::timestamp - ${new Date()}::timestamp)))::float AS diff`;
  expect(cmp!.diff).toBeLessThan(5);
});
