import { BaseRepository } from "../../core/base/base.repository";
import {
  SchoolTripChecklistModel,
  type SchoolTripChecklistDoc,
} from "./school-trip-checklist.model";

export type ChecklistState = "live" | "archived" | "all";

export class SchoolTripChecklistRepository extends BaseRepository<SchoolTripChecklistDoc> {
  constructor() {
    super(SchoolTripChecklistModel);
  }

  filterForState(state: ChecklistState): Record<string, unknown> {
    if (state === "live") return { archivedAt: null };
    if (state === "archived") return { archivedAt: { $ne: null } };
    return {};
  }
}
