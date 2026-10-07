import { BaseRepository } from "../../core/base/base.repository";
import { TestimonialModel, type TestimonialDoc } from "./testimonial.model";

export class TestimonialRepository extends BaseRepository<TestimonialDoc> {
  constructor() {
    super(TestimonialModel);
  }
}
