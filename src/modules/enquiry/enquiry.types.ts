import type { HydratedDocument } from "mongoose";
import type { EnquiryActivity, EnquiryDoc, EnquiryNote, EnquiryStatus } from "./enquiry.model";

export interface Enquiry {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  people?: string;
  trip?: string;
  date?: string;
  message?: string;
  source: string;
  status: EnquiryStatus;
  adminNotes?: string;
  noteHistory: EnquiryNote[];
  activityHistory: EnquiryActivity[];
  isRead: boolean;
  /** Whether the internal admin-notification email was delivered. */
  adminEmailSent: boolean;
  /** Whether the customer-acknowledgement email was delivered (only attempted when `email` is set). */
  customerEmailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEnquiryInput {
  name?: string;
  email?: string;
  phone?: string;
  people?: string;
  trip?: string;
  date?: string;
  message?: string;
  source: string;
}

export interface UpdateEnquiryInput {
  status?: EnquiryStatus;
  adminNotes?: string;
  newNote?: string;
  isRead?: boolean;
}

export const toEnquiryDTO = (doc: HydratedDocument<EnquiryDoc>): Enquiry => {
  const dto: Enquiry = {
    id: doc._id.toString(),
    source: doc.source,
    status: doc.status,
    noteHistory: doc.noteHistory ?? [],
    activityHistory: doc.activityHistory ?? [],
    isRead: doc.isRead,
    adminEmailSent: doc.adminEmailSent,
    customerEmailSent: doc.customerEmailSent,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.name !== undefined) dto.name = doc.name;
  if (doc.email !== undefined) dto.email = doc.email;
  if (doc.phone !== undefined) dto.phone = doc.phone;
  if (doc.people !== undefined) dto.people = doc.people;
  if (doc.trip !== undefined) dto.trip = doc.trip;
  if (doc.date !== undefined) dto.date = doc.date;
  if (doc.message !== undefined) dto.message = doc.message;
  if (doc.adminNotes !== undefined) dto.adminNotes = doc.adminNotes;
  return dto;
};
