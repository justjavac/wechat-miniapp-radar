import { DoctorForm } from "@/app/doctor/doctor-form";

export const metadata = {
  title: "Doctor | 小程序雷达"
};

export default function DoctorPage() {
  return (
    <div className="space-y-8">
      <section className="max-w-4xl">
        <p className="text-sm font-semibold text-primary">Doctor</p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">项目体检</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          基于小程序项目配置和依赖，识别框架、风险依赖、配置缺口和迁移建议。
        </p>
      </section>

      <DoctorForm />
    </div>
  );
}
