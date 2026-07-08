import assert from "node:assert/strict";
import { POST as adminSessionPOST } from "@/app/api/admin/session/route";
import { GET as readinessGET } from "@/app/api/admin/readiness/route";
import { buildResourceMaintenanceLog, PATCH } from "@/app/api/admin/resources/[id]/route";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

const originalEnv = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV
};

function setEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name as string] = value;
  }
}

function context(id = "github-com-nervjstaro") {
  return {
    params: Promise.resolve({ id })
  };
}

function patchRequest(body: unknown, token?: string) {
  return new Request("https://example.com/api/admin/resources/github-com-nervjstaro", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-admin-token": token } : {})
    },
    body: JSON.stringify(body)
  });
}

try {
  setEnv("NODE_ENV", "production");
  setEnv("ADMIN_TOKEN", "admin-secret");
  setEnv("DATABASE_URL", undefined);

  const adminSession = await adminSessionPOST(
    new Request("https://example.com/api/admin/session", {
      method: "POST",
      body: new URLSearchParams({ token: "admin-secret" })
    })
  );
  assert.equal(adminSession.status, 303, "admin session route should redirect after successful login");
  const adminSessionCookie = adminSession.headers.get("set-cookie") ?? "";
  assert.match(adminSessionCookie, new RegExp(`${ADMIN_SESSION_COOKIE}=admin-secret`));
  assert.match(adminSessionCookie, /HttpOnly/);
  assert.match(adminSessionCookie, /SameSite=Lax/i);

  const invalidAdminSession = await adminSessionPOST(
    new Request("https://example.com/api/admin/session", {
      method: "POST",
      body: new URLSearchParams({ token: "wrong" })
    })
  );
  assert.equal(invalidAdminSession.status, 303, "admin session route should redirect after failed login");
  assert.match(invalidAdminSession.headers.get("location") ?? "", /auth=failed/);

  const unauthorizedReadiness = await readinessGET(new Request("https://example.com/api/admin/readiness"));
  assert.equal(unauthorizedReadiness.status, 401, "admin readiness route should reject missing token in production");

  const authorizedReadiness = await readinessGET(
    new Request("https://example.com/api/admin/readiness", {
      headers: { authorization: "Bearer admin-secret" }
    })
  );
  assert.equal(authorizedReadiness.status, 200, "admin readiness route should return production readiness with a valid token");
  const readinessPayload = (await authorizedReadiness.json()) as {
    summary?: { total?: number; missing?: number };
    readiness?: Array<{ id?: string; status?: string; action?: string }>;
    health?: { resources?: { count?: number } };
  };
  assert.ok((readinessPayload.summary?.total ?? 0) > 0, "readiness response should include a summary");
  assert.ok((readinessPayload.summary?.missing ?? 0) > 0, "readiness response should expose missing production items");
  assert.ok(readinessPayload.readiness?.some((item) => item.id === "admin-token" && item.status === "ready"), "readiness response should reuse production readiness items");
  assert.ok(readinessPayload.readiness?.every((item) => item.action), "readiness items should include actionable next steps");
  assert.ok((readinessPayload.health?.resources?.count ?? 0) > 0, "readiness response should include health context");

  const unauthorized = await PATCH(patchRequest({ status: "adopt" }), context());
  assert.equal(unauthorized.status, 401, "admin route should reject missing token in production");

  const invalidStatus = await PATCH(patchRequest({ status: "invalid" }, "admin-secret"), context());
  assert.equal(invalidStatus.status, 400, "admin route should validate status before database access");
  assert.match((await invalidStatus.json()).error, /Invalid status/);

  const emptyPatch = await PATCH(patchRequest({}, "admin-secret"), context());
  assert.equal(emptyPatch.status, 400, "admin route should reject empty patches");

  const validWithoutDatabase = await PATCH(
    patchRequest(
      {
        status: "trial",
        maintainStatus: "active",
        riskLevel: "low",
        summary: "Validated summary"
      },
      "admin-secret"
    ),
    context()
  );
  assert.equal(validWithoutDatabase.status, 503, "admin route should require database for valid maintenance writes");
  assert.match((await validWithoutDatabase.json()).error, /DATABASE_URL/);

  const validWithCookieWithoutDatabase = await PATCH(
    new Request("https://example.com/api/admin/resources/github-com-nervjstaro", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: `${ADMIN_SESSION_COOKIE}=admin-secret`
      },
      body: JSON.stringify({
        status: "trial",
        maintainStatus: "active",
        riskLevel: "low",
        summary: "Validated summary"
      })
    }),
    context()
  );
  assert.equal(validWithCookieWithoutDatabase.status, 503, "admin route should accept a valid HttpOnly session cookie");

  const maintenanceLog = buildResourceMaintenanceLog({
    resourceId: "github-com-nervjstaro",
    resourceTitle: "Taro",
    patch: {
      status: "trial",
      maintainStatus: "active",
      riskLevel: "low",
      summary: "This full summary should not be copied into operation log metadata."
    }
  });
  assert.equal(maintenanceLog.scope, "admin", "resource maintenance logs should use admin scope");
  assert.deepEqual(maintenanceLog.metadata?.fields, ["maintainStatus", "riskLevel", "status", "summary"]);
  assert.deepEqual(maintenanceLog.metadata?.values, {
    status: "trial",
    maintainStatus: "active",
    riskLevel: "low",
    summaryChanged: true
  });
  assert.equal(
    JSON.stringify(maintenanceLog.metadata).includes("This full summary should not be copied"),
    false,
    "resource maintenance logs should not copy full summary text"
  );

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 10,
        assertions: [
          "session cookie",
          "failed session redirect",
          "readiness unauthorized",
          "readiness summary",
          "unauthorized",
          "invalid status",
          "empty patch",
          "database required",
          "cookie authorization",
          "maintenance operation log payload"
        ]
      },
      null,
      2
    )
  );
} finally {
  setEnv("ADMIN_TOKEN", originalEnv.ADMIN_TOKEN);
  setEnv("DATABASE_URL", originalEnv.DATABASE_URL);
  setEnv("NODE_ENV", originalEnv.NODE_ENV);
}
