export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  if (secret) {
    return authorization === `Bearer ${secret}` || querySecret === secret;
  }

  if (process.env.NODE_ENV !== "production") return true;

  return request.headers.get("x-vercel-cron") === "1" || request.headers.get("user-agent")?.toLowerCase().includes("vercel-cron") === true;
}
