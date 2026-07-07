import { createWeeklyReport, readLatestWeeklyReport, type WeeklyReport } from "@/lib/weekly";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}

function cdata(value: string) {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function reportDescription(report: WeeklyReport, origin: string) {
  const sections = [
    `<p>资源总量：${report.stats.total}，推荐采用：${report.stats.adopt}，需要评估：${report.stats.assess}，高风险：${report.stats.highRisk}。</p>`,
    "<h2>推荐关注</h2>",
    "<ul>",
    ...report.highlights.map((resource) => `<li><a href="${escapeXml(new URL(`/resources/${resource.id}`, origin).toString())}">${escapeXml(resource.title)}</a></li>`),
    "</ul>",
    "<h2>风险提醒</h2>",
    "<ul>",
    ...report.risks.map((resource) => `<li><a href="${escapeXml(new URL(`/resources/${resource.id}`, origin).toString())}">${escapeXml(resource.title)}</a></li>`),
    "</ul>"
  ];

  return sections.join("");
}

function renderRss(report: WeeklyReport, origin: string) {
  const siteUrl = new URL("/", origin).toString();
  const weeklyUrl = new URL("/weekly", origin).toString();
  const feedUrl = new URL("/weekly.xml", origin).toString();
  const generatedAt = new Date(report.generatedAt).toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>小程序雷达 Weekly</title>
    <link>${escapeXml(weeklyUrl)}</link>
    <description>小程序生态资源状态、风险提醒和推荐关注周报。</description>
    <language>zh-CN</language>
    <lastBuildDate>${generatedAt}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <item>
      <title>${escapeXml(report.title)}</title>
      <link>${escapeXml(weeklyUrl)}</link>
      <guid isPermaLink="false">${escapeXml(`miniprogram-radar-weekly-${report.id}`)}</guid>
      <pubDate>${generatedAt}</pubDate>
      <description>${cdata(reportDescription(report, origin))}</description>
    </item>
  </channel>
</rss>
<!-- ${escapeXml(siteUrl)} -->
`;
}

export async function GET(request: Request) {
  const report = (await readLatestWeeklyReport()) ?? (await createWeeklyReport());
  const origin = new URL(request.url).origin;

  return new Response(renderRss(report, origin), {
    headers: {
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      "content-type": "application/rss+xml; charset=utf-8"
    }
  });
}
