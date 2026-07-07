import { put } from "@vercel/blob";

export async function uploadTextArtifact(path: string, content: string, contentType = "text/plain; charset=utf-8") {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  const blob = await put(path, content, {
    access: "public",
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return blob.url;
}
