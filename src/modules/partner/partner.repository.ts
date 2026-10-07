import { BaseRepository } from "../../core/base/base.repository";
import { PartnerModel, type PartnerDoc } from "./partner.model";

export class PartnerRepository extends BaseRepository<PartnerDoc> {
  constructor() {
    super(PartnerModel);
  }
}
