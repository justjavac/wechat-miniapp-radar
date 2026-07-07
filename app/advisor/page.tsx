import { AdvisorForm } from "./advisor-form";

export const metadata = {
  title: "Advisor | 小程序雷达"
};

export default function AdvisorPage() {
  return (
    <div className="space-y-6">
      <section className="max-w-4xl">
        <p className="text-sm font-semibold text-primary">Advisor</p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">AI 选型顾问原型</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          这个版本先用资源库和规则生成建议，保留服务端接口结构。接入模型 API 后，回答仍会要求引用本地资源和证据。
        </p>
      </section>
      <AdvisorForm />
    </div>
  );
}
