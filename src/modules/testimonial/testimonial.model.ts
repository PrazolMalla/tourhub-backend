import { Schema, model, type HydratedDocument } from "mongoose";

export interface TestimonialDoc {
  name: string;
  location?: string;
  role?: string;
  rating: number;
  quote: string;
  tripTitle?: string;
  avatarUrl?: string;
  /** Cloudinary public_id for the uploaded avatar. Field name kept as `avatarPath` for API back-compat. */
  avatarPath?: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Playable video src — either a pasted external URL (YouTube/Vimeo) or a Cloudinary secure URL. */
  videoUrl?: string;
  /** Set only when `videoUrl` came from an uploaded file — the Cloudinary public_id, needed to delete/replace it. */
  videoPublicId?: string;
  source?: string;
}

const testimonialSchema = new Schema<TestimonialDoc>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    role: { type: String, trim: true },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    quote: { type: String, required: true, trim: true },
    tripTitle: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    avatarPath: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    videoPublicId: { type: String, trim: true },

    source: {
      type: String,
      enum: ["google", "trip advisor"],
      trim: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export const TestimonialModel = model<TestimonialDoc>("Testimonial", testimonialSchema);
export type TestimonialDocument = HydratedDocument<TestimonialDoc>;
