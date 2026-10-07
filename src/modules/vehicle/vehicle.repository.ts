import { BaseRepository } from "../../core/base/base.repository";
import { VehicleModel, type VehicleDoc } from "./vehicle.model";

export class VehicleRepository extends BaseRepository<VehicleDoc> {
  constructor() {
    super(VehicleModel);
  }

  findBySlug(slug: string) {
    return this.findOne({ slug: slug.toLowerCase() });
  }
}
