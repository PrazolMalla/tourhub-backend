import { Schema, model, type HydratedDocument } from "mongoose";

/** A downloadable school-trip checklist PDF, grouped by admin-defined type. */
export interface SchoolTripChecklistDoc {
  type: string;
  slug: string;
  /** Cloudinary public_id (resource_type "raw"). Field name kept as `pdfPath` for API back-compat. */
  pdfPath?: string;
  pdfUrl?: string;
  pdfOriginalName?: string;
  isActive: boolean;
  sortOrder: number;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schoolTripChecklistSchema = new Schema<SchoolTripChecklistDoc>(
  {
    type: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    pdfPath: { type: String, trim: true },
    pdfUrl: { type: String, trim: true },
    pdfOriginalName: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export const SchoolTripChecklistModel = model<SchoolTripChecklistDoc>(
  "SchoolTripChecklist",
  schoolTripChecklistSchema,
);
export type SchoolTripChecklistDocument = HydratedDocument<SchoolTripChecklistDoc>;
