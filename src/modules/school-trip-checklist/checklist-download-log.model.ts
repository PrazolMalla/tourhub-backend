import { Schema, Types, model, type HydratedDocument } from "mongoose";

export type ChecklistDownloadStatus = "success" | "failed";

/**
 * One row per download attempt of a school-trip checklist PDF — visible only
 * to staff (admin/superadmin), never exposed publicly. `checklistType` is
 * denormalized so the log stays readable even if the checklist is later
 * renamed or deleted.
 */
export interface ChecklistDownloadLogDoc {
  checklistId?: Types.ObjectId;
  checklistType: string;
  name: string;
  phone: string;
  status: ChecklistDownloadStatus;
  failureReason?: string;
  ip?: string;
  country?: string;
  countryName?: string;
  region?: string;
  city?: string;
  userAgent?: string;
  createdAt: Date;
}

const checklistDownloadLogSchema = new Schema<ChecklistDownloadLogDoc>(
  {
    checklistId: { type: Schema.Types.ObjectId, ref: "SchoolTripChecklist", index: true },
    checklistType: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    status: { type: String, enum: ["success", "failed"], required: true, index: true },
    failureReason: { type: String, trim: true },
    ip: { type: String },
    country: { type: String, index: true },
    countryName: { type: String },
    region: { type: String },
    city: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

checklistDownloadLogSchema.index({ createdAt: -1 });

export const ChecklistDownloadLogModel = model<ChecklistDownloadLogDoc>(
  "ChecklistDownloadLog",
  checklistDownloadLogSchema,
);
export type ChecklistDownloadLogDocument = HydratedDocument<ChecklistDownloadLogDoc>;
