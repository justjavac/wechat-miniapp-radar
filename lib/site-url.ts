// 部署后请通过 SITE_URL 或 NEXT_PUBLIC_SITE_URL 指定真实域名，此处仅作兜底。
const DEFAULT_SITE_URL = "https://miniapp.denohub.com";

export function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.DEPLOYMENT_BASE_URL ||
    DEFAULT_SITE_URL;
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

export function absoluteUrl(path: string) {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
