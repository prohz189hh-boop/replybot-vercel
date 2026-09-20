/**
 * Object storage abstraction. `R2Storage` (Cloudflare R2, S3-compatible)
 * is used automatically when STORAGE_PROVIDER=r2 is configured;
 * `LocalDiskStorage` is the dev-only fallback. Swap in S3/GCS the same
 * way — implement StorageProvider, select it in getStorage().
 */

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<string>; // returns a fetchable URL/path
  getSignedUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

export function validateUpload(file: { size: number; type: string; name: string }) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File exceeds maximum size of 15MB");
  }
  if (/[/\\]/.test(file.name) || file.name.includes("..")) {
    throw new Error("Invalid filename");
  }
}

/**
 * Verifies the file's actual bytes match its claimed MIME type, rather
 * than trusting the Content-Type the client sent (trivially spoofable —
 * a multipart upload's declared type is just a string the browser or
 * an attacker chose). Call this AFTER validateUpload() and BEFORE text
 * extraction/storage.
 */
export function verifyFileSignature(buffer: Buffer, claimedType: string): void {
  const PDF_MAGIC = Buffer.from("%PDF-");
  const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // DOCX is a zip container

  if (claimedType === "application/pdf") {
    if (!buffer.subarray(0, 5).equals(PDF_MAGIC)) {
      throw new Error("File content doesn't match a PDF (signature mismatch).");
    }
    return;
  }

  if (claimedType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (!buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
      throw new Error("File content doesn't match a .docx (signature mismatch).");
    }
    return;
  }

  if (claimedType === "text/plain") {
    // No universal magic bytes for plain text — reject anything that
    // isn't valid UTF-8 (a PDF/zip/binary renamed to .txt will fail
    // this decode) and reject embedded NUL bytes, which text files
    // never legitimately contain.
    if (buffer.includes(0)) {
      throw new Error("File content doesn't look like plain text (contains binary data).");
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new Error("File content isn't valid UTF-8 text.");
    }
    return;
  }

  throw new Error(`No signature check defined for ${claimedType}`);
}

class LocalDiskStorage implements StorageProvider {
  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), ".storage");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key.replace(/\//g, "_")), data);
    return `/api/internal/local-storage/${encodeURIComponent(key)}`;
  }

  async getSignedUrl(key: string): Promise<string> {
    return `/api/internal/local-storage/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), ".storage");
    await fs.unlink(path.join(dir, key.replace(/\//g, "_"))).catch(() => {});
  }
}

/**
 * Cloudflare R2 — speaks the S3 API, so this uses the official AWS SDK
 * (`@aws-sdk/client-s3`) pointed at R2's endpoint rather than hand-
 * rolling SigV4 request signing, which is exactly the kind of
 * security-sensitive plumbing not worth reimplementing.
 *
 * Requires: STORAGE_PROVIDER=r2, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID,
 * STORAGE_SECRET_ACCESS_KEY, and STORAGE_R2_ACCOUNT_ID (R2's endpoint is
 * `https://<account-id>.r2.cloudflarestorage.com` — the account id is
 * NOT the same as the access key id, and isn't derivable from it).
 */
class R2Storage implements StorageProvider {
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client>;
  private bucket: string;

  constructor(accountId: string, bucket: string, accessKeyId: string, secretAccessKey: string) {
    this.bucket = bucket;
    // Dynamic import (not `require`) so this works under both ESM and
    // CJS output, and so a missing @aws-sdk/client-s3 install fails
    // clearly the first time storage is actually used rather than at
    // module load time for code paths that don't need it.
    this.clientPromise = import("@aws-sdk/client-s3").then(
      ({ S3Client }) =>
        new S3Client({
          region: "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        }),
    );
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const [{ PutObjectCommand }, client] = await Promise.all([import("@aws-sdk/client-s3"), this.clientPromise]);
    await client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
    // Not a public URL — R2 buckets are private by default here.
    // Callers fetch the actual bytes via getSignedUrl().
    return key;
  }

  async getSignedUrl(key: string): Promise<string> {
    const [{ GetObjectCommand }, { getSignedUrl }, client] = await Promise.all([
      import("@aws-sdk/client-s3"),
      import("@aws-sdk/s3-request-presigner"),
      this.clientPromise,
    ]);
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 60 * 15, // 15 minutes — short-lived, re-requested per use rather than cached
    });
  }

  async delete(key: string): Promise<void> {
    const [{ DeleteObjectCommand }, client] = await Promise.all([import("@aws-sdk/client-s3"), this.clientPromise]);
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

// TODO: implement S3Storage/GCSStorage the same way if you're not on R2.
let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;

  if (process.env.STORAGE_PROVIDER === "r2") {
    const accountId = process.env.STORAGE_R2_ACCOUNT_ID;
    const bucket = process.env.STORAGE_BUCKET;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "STORAGE_PROVIDER=r2 requires STORAGE_R2_ACCOUNT_ID, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, and STORAGE_SECRET_ACCESS_KEY to all be set.",
      );
    }
    cached = new R2Storage(accountId, bucket, accessKeyId, secretAccessKey);
    return cached;
  }

  cached = new LocalDiskStorage();
  return cached;
}
