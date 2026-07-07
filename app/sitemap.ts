import type { MetadataRoute } from "next";
import { getResources } from "@/lib/resources";
import { absoluteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const resources = await getResources();
  const now = new Date();
  const staticRoutes = ["", "/radar", "/compare", "/advisor", "/doctor", "/weekly"].map((path) => ({
    url: absoluteUrl(path || "/"),
    lastModified: now,
    changeFrequency: path === "" || path === "/radar" ? ("daily" as const) : ("weekly" as const),
    priority: path === "" ? 1 : path === "/radar" ? 0.9 : 0.7
  }));

  const resourceRoutes = resources.map((resource) => ({
    url: absoluteUrl(`/resources/${resource.id}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: resource.radar.status === "adopt" ? 0.7 : 0.5
  }));

  return [...staticRoutes, ...resourceRoutes];
}
