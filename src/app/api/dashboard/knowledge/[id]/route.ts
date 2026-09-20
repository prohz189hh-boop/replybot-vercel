import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireResourceAccess, requirePermission, TenantAccessError } from "@/lib/tenant/guard";
import { getStorage } from "@/lib/storage/storage";
import { logAudit } from "@/lib/security/audit";

async function loadSource(id: string) {
  return prisma.knowledgeSource.findUnique({ where: { id } });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { resource: source } = await requireResourceAccess(
      () => loadSource(params.id),
      (s) => s?.businessId,
      "AGENT",
    );
    return NextResponse.json({ source });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { resource: source, session } = await requireResourceAccess(
      () => loadSource(params.id),
      (s) => s?.businessId,
      "AGENT",
    );
    await requirePermission(source.businessId, "knowledge.manage");

    // KnowledgeChunk rows cascade-delete via the FK (onDelete: Cascade
    // in schema.prisma) — deleting the source is enough to remove its
    // vectors too. The uploaded file itself does not cascade
    // automatically (object storage isn't a foreign key), so remove it
    // explicitly here to avoid orphaned files outliving the record that
    // references them.
    if (source.filePath) {
      await getStorage().delete(source.filePath).catch((err) => {
        console.error("Failed to delete stored file for knowledge source", { sourceId: source.id, err });
      });
    }

    await prisma.knowledgeSource.delete({ where: { id: source.id } });

    await logAudit({
      businessId: source.businessId,
      userId: session.user.id,
      action: "knowledge.deleted",
      metadata: { sourceId: source.id, name: source.name },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TenantAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
