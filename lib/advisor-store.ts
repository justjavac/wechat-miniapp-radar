import { createHash } from "node:crypto";
import { createDb } from "@/db/client";
import { advisorSessions } from "@/db/schema";
import type { AdvisorAnswer } from "@/lib/advisor";

export async function persistAdvisorSession(answer: AdvisorAnswer) {
  if (!process.env.DATABASE_URL) return false;

  const db = createDb();
  const id = createHash("sha1").update(`${answer.question}:${Date.now()}`).digest("hex");

  await db.insert(advisorSessions).values({
    id,
    question: answer.question,
    answer
  });

  return true;
}
