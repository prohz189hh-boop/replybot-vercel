/**
 * Seeds the "Northstar Coffee" demo — a fictional business used for the
 * public demo mode (spec section 31). Run with: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { chunkText } from "../src/lib/rag/indexer";
import { getAIProvider } from "../src/lib/ai/provider";

const prisma = new PrismaClient();

async function main() {
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@replypilot.example" },
    create: {
      email: "demo@replypilot.example",
      passwordHash: await hashPassword("demo-password-change-me"),
      name: "Demo Owner",
      emailVerified: new Date(),
    },
    update: {},
  });

  const business = await prisma.business.upsert({
    where: { id: "demo-northstar-coffee" },
    create: {
      id: "demo-northstar-coffee",
      name: "Northstar Coffee",
      website: "https://northstar-coffee.example",
      industry: "Food & Beverage",
      description: "A fictional neighborhood coffee shop used for the ReplyPilot demo.",
      supportedLanguages: ["en"],
    },
    update: {},
  });

  await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId: business.id, userId: demoUser.id } },
    create: { businessId: business.id, userId: demoUser.id, role: "OWNER" },
    update: {},
  });

  const agent = await prisma.agent.upsert({
    where: { id: "demo-northstar-agent" },
    create: {
      id: "demo-northstar-agent",
      businessId: business.id,
      name: "Northstar Support",
      personality: "FRIENDLY",
    },
    update: {},
  });

  await prisma.widgetConfiguration.upsert({
    where: { agentId: agent.id },
    create: {
      agentId: agent.id,
      welcomeMessage: "Hey there! 👋 Ask me anything about Northstar Coffee.",
      primaryColor: "#8B5E3C",
      chatButtonText: "Chat with Northstar",
    },
    update: {},
  });

  const demoKnowledge = [
    "Northstar Coffee is open Monday-Friday 7am-6pm and Saturday-Sunday 8am-4pm.",
    "Our menu includes drip coffee, espresso drinks, cold brew, and a rotating pastry case. Oat and almond milk are available at no extra charge.",
    "We're located at 142 Elm Street. Street parking is available, and there's a public lot one block north.",
    "We offer local delivery within 2 miles via our website for orders over $15, with a flat $3 delivery fee.",
    "Refunds are available within 24 hours of purchase for any order — just bring your receipt or show your order confirmation email.",
  ].join("\n\n");

  const source = await prisma.knowledgeSource.upsert({
    where: { id: "demo-northstar-manual" },
    create: {
      id: "demo-northstar-manual",
      businessId: business.id,
      agentId: agent.id,
      type: "MANUAL_TEXT",
      name: "Northstar basics",
      rawContent: demoKnowledge,
      status: "PROCESSING",
    },
    update: { rawContent: demoKnowledge, status: "PROCESSING" },
  });

  const ai = getAIProvider();
  const chunks = chunkText(demoKnowledge);
  const embeddings = await ai.embed(chunks);

  await prisma.knowledgeChunk.deleteMany({ where: { knowledgeSourceId: source.id } });
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    if (!chunk || !embedding) {
      throw new Error(`Missing chunk or embedding at index ${i}`);
    }
    const vectorLiteral = `[${embedding.join(",")}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "KnowledgeChunk" (id, "knowledgeSourceId", "businessId", content, embedding, "tokenCount", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector, $5, now())`,
      source.id,
      business.id,
      chunk,
      vectorLiteral,
      Math.ceil(chunk.length / 4),
    );
  }

  await prisma.knowledgeSource.update({
    where: { id: source.id },
    data: { status: "READY", chunkCount: chunks.length, lastIndexedAt: new Date() },
  });

  console.log(`Seeded demo business "${business.name}" with agent publicId: ${agent.publicId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
