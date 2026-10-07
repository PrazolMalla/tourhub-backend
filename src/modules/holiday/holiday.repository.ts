import { BaseRepository } from "../../core/base/base.repository";
import { HolidayModel, type HolidayDoc } from "./holiday.model";

export class HolidayRepository extends BaseRepository<HolidayDoc> {
  constructor() {
    super(HolidayModel);
  }

  findBySlug(slug: string) {
    return this.findOne({ slug: slug.toLowerCase() });
  }
}
