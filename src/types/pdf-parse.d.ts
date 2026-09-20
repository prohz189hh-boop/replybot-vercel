/** Type declarations for the pdf-parse v1 CommonJS API. */
declare module "pdf-parse" {
  export default function parse(buffer: Buffer): Promise<{ text: string }>;
}
