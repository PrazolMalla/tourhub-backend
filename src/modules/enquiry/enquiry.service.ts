import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import { EmailService } from "../../core/email/email.service";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { AdminModel } from "../admin/admin.model";
import type { EnquiryStatus } from "./enquiry.model";
import { EnquiryRepository } from "./enquiry.repository";
import {
  toEnquiryDTO,
  type CreateEnquiryInput,
  type Enquiry,
  type UpdateEnquiryInput,
} from "./enquiry.types";

export interface EnquiryListFilters {
  status?: EnquiryStatus;
  source?: string;
  isRead?: boolean;
  state?: "live" | "all";
}

export class EnquiryService extends BaseService<EnquiryRepository> {
  async create(
    input: CreateEnquiryInput,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<Enquiry> {
    const payload: Partial<CreateEnquiryInput> & {
      source: string;
      status: EnquiryStatus;
      isRead: boolean;
      ip?: string;
      userAgent?: string;
    } = {
      source: input.source.trim(),
      status: "new",
      isRead: false,
    };
    if (input.name !== undefined) payload.name = input.name;
    if (input.email !== undefined) payload.email = input.email;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.people !== undefined) payload.people = input.people;
    if (input.trip !== undefined) payload.trip = input.trip;
    if (input.date !== undefined) payload.date = input.date;
    if (input.message !== undefined) payload.message = input.message;
    if (meta?.ip) payload.ip = meta.ip;
    if (meta?.userAgent) payload.userAgent = meta.userAgent;
    const doc = await this.repository.create(payload);
    const dto = toEnquiryDTO(doc);
    // Fire-and-forget notifications — never block or fail the request.
    // 1) Notify the internal inbox (ENQUIRY_NOTIFY_EMAIL). 2) Acknowledge the
    // customer when they left an email. Both are best-effort (no throw); the
    // resulting true/false is written back so admins can see delivery status.
    this.trackEmail(
      dto.id,
      "adminEmailSent",
      "Enquiry admin notification",
      EmailService.sendEnquiryAdminNotification(dto),
    );
    this.trackEmail(
      dto.id,
      "customerEmailSent",
      "Enquiry acknowledgement",
      EmailService.sendEnquiryAcknowledgement(dto),
    );
    return dto;
  }

  private trackEmail(
    id: string,
    field: "adminEmailSent" | "customerEmailSent",
    label: string,
    send: Promise<boolean>,
  ): void {
    void send
      .then((sent) => {
        if (!sent)
          console.error(`[enquiry] ${label} returned false (see [email] logs above for cause)`, {
            id,
          });
        return sent;
      })
      .catch((err) => {
        console.error(`[enquiry] ${label} threw`, { id, err });
        this.logger.warn(`${label} failed`, { err: String(err) });
        return false;
      })
      .then((sent) => this.repository.update(id, { [field]: sent }))
      .catch((err) => this.logger.warn(`${label} status update failed`, { err: String(err) }));
  }

  async list(
    options: PaginationOptions,
    filters: EnquiryListFilters = {},
  ): Promise<PaginatedResult<Enquiry>> {
    const filter: Record<string, unknown> = {};
    if (filters.status) filter.status = filters.status;
    if (filters.source) filter.source = filters.source;
    if (filters.isRead !== undefined) filter.isRead = filters.isRead;
    if (options.search) {
      const rx = { $regex: escapeRegex(options.search), $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }, { message: rx }, { trip: rx }];
    }
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toEnquiryDTO), total, options);
  }

  async findById(id: string): Promise<Enquiry> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Enquiry ${id} not found`);
    return toEnquiryDTO(doc);
  }

  async markRead(id: string, read: boolean): Promise<Enquiry> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Enquiry ${id} not found`);
    doc.isRead = read;
    await doc.save();
    return toEnquiryDTO(doc);
  }

  async updateStatus(id: string, status: EnquiryStatus, adminNotes?: string): Promise<Enquiry> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Enquiry ${id} not found`);
    doc.status = status;
    if (adminNotes !== undefined) doc.adminNotes = adminNotes;
    await doc.save();
    return toEnquiryDTO(doc);
  }

  async update(id: string, input: UpdateEnquiryInput, adminId?: string): Promise<Enquiry> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Enquiry ${id} not found`);

    const changes: { field: string; from?: string; to?: string }[] = [];
    if (input.status !== undefined && input.status !== doc.status) {
      changes.push({ field: "Status", from: doc.status, to: input.status });
      doc.status = input.status;
    }
    if (input.adminNotes !== undefined) doc.adminNotes = input.adminNotes;
    if (input.isRead !== undefined && input.isRead !== doc.isRead) {
      changes.push({
        field: "Read state",
        from: doc.isRead ? "Read" : "Unread",
        to: input.isRead ? "Read" : "Unread",
      });
      doc.isRead = input.isRead;
    }
    if (input.newNote) {
      doc.noteHistory.push({
        text: input.newNote,
        createdAt: new Date(),
        ...(adminId && { createdBy: adminId }),
      });
    }

    if (changes.length || input.newNote) {
      const admin = adminId
        ? await AdminModel.findById(adminId).select({ name: 1, email: 1 }).lean()
        : null;
      doc.activityHistory.push({
        createdAt: new Date(),
        actor: {
          id: adminId ?? "unknown",
          ...(admin?.name && { name: admin.name }),
          ...(admin?.email && { email: admin.email }),
        },
        changes,
        ...(input.newNote && { note: input.newNote }),
      });
    }
    await doc.save();
    return toEnquiryDTO(doc);
  }

  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.delete(id);
    if (!doc) throw new NotFoundError(`Enquiry ${id} not found`);
  }

  /** Count of unread enquiries — handy for an admin badge. */
  async unreadCount(): Promise<number> {
    return this.repository.count({ isRead: false });
  }
}
