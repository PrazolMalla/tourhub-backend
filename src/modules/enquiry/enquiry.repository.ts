import { BaseRepository } from "../../core/base/base.repository";
import { EnquiryModel, type EnquiryDoc } from "./enquiry.model";

export class EnquiryRepository extends BaseRepository<EnquiryDoc> {
  constructor() {
    super(EnquiryModel);
  }
}
