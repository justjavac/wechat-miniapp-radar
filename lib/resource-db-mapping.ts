import { resourceAlternatives, resources as resourcesTable } from "@/db/schema";
import { findAlternativeResources, type RadarResource } from "@/lib/resources";

export type ResourceInsert = typeof resourcesTable.$inferInsert;
export type ResourceAlternativeInsert = typeof resourceAlternatives.$inferInsert;

export function mapResourceToDbInsert(resource: RadarResource): ResourceInsert {
  return {
    id: resource.id,
    title: resource.title,
    url: resource.url,
    description: resource.description,
    note: resource.note || null,
    categoryId: resource.categoryId,
    categoryName: resource.category,
    sectionId: resource.sectionId,
    sectionName: resource.section,
    resourceType: resource.radar.type,
    status: resource.radar.status,
    maintainStatus: resource.radar.maintainStatus,
    riskLevel: resource.radar.riskLevel,
    summary: resource.radar.summary,
    metadata: resource.metadata
  };
}

export function mapResourceToDbUpdate(resource: RadarResource): Partial<ResourceInsert> {
  return {
    ...mapResourceToDbInsert(resource),
    updatedAt: new Date()
  };
}

export function mapResourcesToAlternativeDbInserts(resources: RadarResource[]): ResourceAlternativeInsert[] {
  const rows: ResourceAlternativeInsert[] = [];

  for (const resource of resources) {
    const alternatives = findAlternativeResources(resources, resource);
    for (const [index, alternative] of alternatives.entries()) {
      rows.push({
        id: `${resource.id}__${index}__${alternative.id}`,
        sourceResourceId: resource.id,
        targetResourceId: alternative.id,
        label: alternative.label,
        rank: index
      });
    }
  }

  return rows;
}
