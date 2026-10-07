import { Schema, model, type HydratedDocument } from "mongoose";

export interface TeamMemberDoc {
  /** Cloudinary secure URL (or an admin-pasted external URL). */
  profilePhoto?: string;
  /** Set only when `profilePhoto` came from an uploaded file — the Cloudinary public_id, needed to delete/replace it. */
  profilePhotoPublicId?: string;

  /** Team member's full name. */
  name: string;

  /** Position or title (e.g. Founder & Lead Guide). */
  role: string;

  /** Location (e.g. Kathmandu). */
  location: string;

  /** Short biography/description. */
  description: string;

  /** Soft delete support. */
  deletedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const teamMemberSchema = new Schema<TeamMemberDoc>(
  {
    profilePhoto: {
      type: String,
      trim: true,
    },
    profilePhotoPublicId: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

teamMemberSchema.index({ createdAt: -1 });
teamMemberSchema.index({ name: "text", role: "text", location: "text" });

export const TeamMemberModel = model<TeamMemberDoc>("TeamMember", teamMemberSchema);

export type TeamMemberDocument = HydratedDocument<TeamMemberDoc>;
