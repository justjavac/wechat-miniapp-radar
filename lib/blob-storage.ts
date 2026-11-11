import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const STORE_NAME = process.env.EDGEONE_BLOB_STORE || "miniprogram-radar";

interface BlobStoreLike {
  set(key: string, value: string): Promise<void>;
  get(key: string, options?: { type?: string; consistency?: string }): Promise<unknown>;
}

let edgeOneStorePromise: Promise<BlobStoreLike | null> | null = null;
let edgeOneDisabled = false;

async function getEdgeOneStore(): Promise<BlobStoreLike | null> {
  if (edgeOneDisabled) return null;

  if (!edgeOneStorePromise) {
    edgeOneStorePromise = (async () => {
      try {
        const mod = await import("@edgeone/pages-blob");
        const projectId = process.env.EDGEONE_PROJECT_ID;
        const token = process.env.EDGEONE_API_TOKEN;
        const store =
          projectId && token
            ? mod.getStore({ name: STORE_NAME, projectId, token })
            : mod.getStore(STORE_NAME);
        return store as unknown as BlobStoreLike;
      } catch {
        edgeOneDisabled = true;
        return null;
      }
    })();
  }

  return edgeOneStorePromise;
}

function localPathFor(path: string) {
  return join(process.cwd(), "public", path);
}

export async function putTextArtifact(
  path: string,
  content: string,
  contentType = "text/plain; charset=utf-8"
) {
  const store = await getEdgeOneStore();

  if (store) {
    try {
      await store.set(path, content);
      return `blob://${STORE_NAME}/${path}`;
    } catch (error) {
      console.warn(
        `EdgeOne Blob write failed for ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
      edgeOneDisabled = true;
    }
  }

  if (process.env.BLOB_BACKEND !== "local") return null;

  const target = localPathFor(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return target;
}

export async function getTextArtifact(path: string): Promise<string | null> {
  const store = await getEdgeOneStore();

  if (store) {
    try {
      const value = await store.get(path, { type: "text", consistency: "strong" });
      return typeof value === "string" ? value : null;
    } catch (error) {
      console.warn(
        `EdgeOne Blob read failed for ${path}, falling back to local file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      edgeOneDisabled = true;
    }
  }

  try {
    return await readFile(localPathFor(path), "utf8");
  } catch {
    return null;
  }
}

export const uploadTextArtifact = putTextArtifact;
