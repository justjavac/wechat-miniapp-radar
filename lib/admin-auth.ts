export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_TOKEN);
}

export function isAdminTokenValid(token: string | null | undefined) {
  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    return process.env.NODE_ENV !== "production";
  }

  return token === configuredToken;
}

export function getAdminTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const headerToken = request.headers.get("x-admin-token");
  if (headerToken) return headerToken;

  return new URL(request.url).searchParams.get("token");
}

export function isAdminRequestAuthorized(request: Request) {
  return isAdminTokenValid(getAdminTokenFromRequest(request));
}
