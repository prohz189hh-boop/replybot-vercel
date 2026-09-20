import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireResourceAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { indexKnowledgeSource } from "@/lib/rag/indexer";
import { crawlSinglePage } from "@/lib/crawler/crawler";
import { extractTextFromFile } from "@/lib/knowledge/extract-text";
import { getStorage } from "@/lib/storage/storage";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/security/audit";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { resource: source, session } = await requireResourceAccess(
      () => prisma.knowledgeSource.findUnique({ where: { id: params.id } }),
      (s) => s?.businessId,
      "AGENT",
    );
    await requirePermission(source.businessId, "knowledge.manage");

    const rate = await checkRateLimit(`reindex:${source.businessId}`, RATE_LIMITS.crawling);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many reindex requests. Try again in a minute." }, { status: 429 });
    }

    let content: string;
    if (source.type === "WEBSITE") {
      if (!source.sourceUrl) return NextResponse.json({ error: "Source has no URL to re-crawl" }, { status: 400 });
      const page = await crawlSinglePage(source.sourceUrl);
      content = page.text;
    } else if (source.type === "FILE") {
      if (!source.filePath) return NextResponse.json({ error: "Source has no stored file to re-read" }, { status: 400 });
      // getStorage().getSignedUrl would work for R2, but for re-indexing
      // we need the raw bytes, not a URL — re-fetch through the signed
      // URL so this works for both local disk and R2 without a
      // provider-specific branch here.
      const url = await getStorage().getSignedUrl(source.filePath);
      const res = await fetch(url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_APP_URL}${url}`);
      if (!res.ok) return NextResponse.json({ error: "Could not re-read the stored file" }, { status: 500 });
      const buffer = Buffer.from(await res.arrayBuffer());
      const mimeType =
        source.filePath.endsWith(".pdf") ? "application/pdf" :
        source.filePath.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
        "text/plain";
      content = await extractTextFromFile(buffer, mimeType);
    } else {
      if (!source.rawContent) return NextResponse.json({ error: "Source has no content to re-index" }, { status: 400 });
      content = source.rawContent;
    }

    await indexKnowledgeSource(source.id, content);

    await logAudit({
      businessId: source.businessId,
      userId: session.user.id,
      action: "knowledge.reindexed",
      metadata: { sourceId: source.id },
    });

    const updated = await prisma.knowledgeSource.findUnique({ where: { id: source.id } });
    return NextResponse.json({ source: updated });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
