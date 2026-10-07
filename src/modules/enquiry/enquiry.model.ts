import { Schema, model, type HydratedDocument } from "mongoose";

export type EnquiryStatus = "new" | "contacted" | "converted" | "closed" | "spam";

export interface EnquiryNote {
  text: string;
  createdAt: Date;
  createdBy?: string;
}

export interface EnquiryActivity {
  createdAt: Date;
  actor: { id: string; name?: string; email?: string };
  changes: { field: string; from?: string; to?: string }[];
  note?: string;
}

export interface EnquiryDoc {
  name?: string;
  email?: string;
  phone?: string;
  people?: string;
  /** Trip they're interested in. */
  trip?: string;
  /** Preferred travel date (free text). */
  date?: string;
  message?: string;
  /** Origin form, e.g. "contact", "hire", "trip". */
  source: string;
  status: EnquiryStatus;
  adminNotes?: string;
  noteHistory: EnquiryNote[];
  activityHistory: EnquiryActivity[];
  isRead: boolean;
  ip?: string;
  userAgent?: string;
  /** Whether the internal admin-notification email was delivered. */
  adminEmailSent: boolean;
  /** Whether the customer-acknowledgement email was delivered (only attempted when `email` is set). */
  customerEmailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<EnquiryDoc>(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    people: { type: String, trim: true },
    trip: { type: String, trim: true },
    date: { type: String, trim: true },
    message: { type: String, trim: true },
    source: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["new", "contacted", "converted", "closed", "spam"],
      default: "new",
      index: true,
    },
    adminNotes: { type: String, trim: true },
    noteHistory: {
      type: [
        new Schema(
          {
            text: { type: String, required: true, trim: true },
            createdAt: { type: Date, required: true, default: Date.now },
            createdBy: { type: String },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    activityHistory: {
      type: [
        new Schema(
          {
            createdAt: { type: Date, required: true, default: Date.now },
            actor: {
              id: { type: String, required: true },
              name: { type: String },
              email: { type: String },
            },
            changes: {
              type: [
                new Schema(
                  {
                    field: { type: String, required: true },
                    from: { type: String },
                    to: { type: String },
                  },
                  { _id: false },
                ),
              ],
              default: [],
            },
            note: { type: String },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    isRead: { type: Boolean, default: false, index: true },
    ip: { type: String },
    userAgent: { type: String },
    adminEmailSent: { type: Boolean, default: false },
    customerEmailSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

enquirySchema.index({ createdAt: -1 });

export const EnquiryModel = model<EnquiryDoc>("Enquiry", enquirySchema);
export type EnquiryDocument = HydratedDocument<EnquiryDoc>;
