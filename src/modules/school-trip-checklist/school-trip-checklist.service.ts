import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { docFileToRecord, hardDeleteFile } from "../../core/utils/uploads";
import { requireSlug, slugify } from "../../core/utils/slug.util";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import type {
  ChecklistState,
  SchoolTripChecklistRepository,
} from "./school-trip-checklist.repository";
import type { ChecklistDownloadLogRepository } from "./checklist-download-log.repository";
import {
  toSchoolTripChecklistDTO,
  toPublicSchoolTripChecklist,
  toChecklistDownloadLogDTO,
  type SchoolTripChecklist,
  type PublicSchoolTripChecklist,
  type CreateSchoolTripChecklistInput,
  type UpdateSchoolTripChecklistInput,
  type ChecklistDownloadLog,
} from "./school-trip-checklist.types";
import type { ChecklistDownloadStatus } from "./checklist-download-log.model";

export interface GeoContext {
  ip?: string;
  country?: string;
  countryName?: string;
  region?: string;
  city?: string;
  userAgent?: string;
}

export interface RecordDownloadInput {
  checklistId: string;
  name: string;
  phone: string;
  geo: GeoContext;
}

export class SchoolTripChecklistService extends BaseService<SchoolTripChecklistRepository> {
  constructor(
    repository: SchoolTripChecklistRepository,
    private readonly logs: ChecklistDownloadLogRepository,
  ) {
    super(repository);
  }

  async list(
    options: PaginationOptions,
    state: ChecklistState = "live",
  ): Promise<PaginatedResult<SchoolTripChecklist>> {
    const filter = this.repository.filterForState(state);
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toSchoolTripChecklistDTO), total, options);
  }

  /** Active checklists for the public download dropdown. */
  async listPublic(): Promise<PublicSchoolTripChecklist[]> {
    const docs = await this.repository.findAll(
      { isActive: true, archivedAt: null },
      { sort: { sortOrder: 1 } },
    );
    return docs.map(toPublicSchoolTripChecklist);
  }

  async findById(id: string): Promise<SchoolTripChecklist> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Checklist ${id} not found`);
    return toSchoolTripChecklistDTO(doc);
  }

  async create(
    input: CreateSchoolTripChecklistInput,
    file?: Express.Multer.File,
  ): Promise<SchoolTripChecklist> {
    const baseSlug = requireSlug(input.slug ?? input.type);
    let slug = baseSlug;
    let n = 1;
    while (await this.repository.findOne({ slug })) {
      slug = `${baseSlug}-${++n}`;
    }
    const payload: Record<string, unknown> = {
      type: input.type.trim(),
      slug,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    };
    if (file) {
      const record = docFileToRecord("checklist", file);
      payload.pdfPath = record.publicId;
      payload.pdfUrl = record.url;
      payload.pdfOriginalName = record.originalName;
    }
    const doc = await this.repository.create(payload);
    return toSchoolTripChecklistDTO(doc);
  }

  async update(id: string, input: UpdateSchoolTripChecklistInput): Promise<SchoolTripChecklist> {
    const next: Record<string, unknown> = { ...input };
    if (input.type) next.type = input.type.trim();
    if (input.slug) next.slug = slugify(input.slug);
    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Checklist ${id} not found`);
    return toSchoolTripChecklistDTO(doc);
  }

  async uploadPdf(id: string, file: Express.Multer.File): Promise<SchoolTripChecklist> {
    const record = docFileToRecord("checklist", file);
    const doc = await this.repository.findById(id);
    if (!doc) {
      await hardDeleteFile(record.publicId, "raw");
      throw new NotFoundError(`Checklist ${id} not found`);
    }
    if (doc.pdfPath) await hardDeleteFile(doc.pdfPath, "raw");
    doc.pdfPath = record.publicId;
    doc.pdfUrl = record.url;
    doc.pdfOriginalName = record.originalName;
    await doc.save();
    return toSchoolTripChecklistDTO(doc);
  }

  async removePdf(id: string): Promise<SchoolTripChecklist> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Checklist ${id} not found`);
    if (doc.pdfPath) await hardDeleteFile(doc.pdfPath, "raw");
    doc.pdfPath = undefined as unknown as string;
    doc.pdfUrl = undefined as unknown as string;
    doc.pdfOriginalName = undefined as unknown as string;
    await doc.save();
    return toSchoolTripChecklistDTO(doc);
  }

  async archive(id: string): Promise<SchoolTripChecklist> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Checklist ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toSchoolTripChecklistDTO(doc);
  }

  async unarchive(id: string): Promise<SchoolTripChecklist> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Checklist ${id} not found`);
    doc.archivedAt = null;
    await doc.save();
    return toSchoolTripChecklistDTO(doc);
  }

  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Checklist ${id} not found`);
    if (doc.pdfPath) await hardDeleteFile(doc.pdfPath, "raw");
    await this.repository.delete(id);
  }

  /**
   * Log a download attempt and, on success, hand back the PDF URL for the
   * caller to serve/redirect. Every attempt is logged (success or failed) so
   * staff have a full audit trail — this never throws for a "not found"
   * checklist, it just logs a failed attempt and returns null.
   */
  async recordDownload(input: RecordDownloadInput): Promise<{ pdfUrl: string } | null> {
    const doc = await this.repository.findById(input.checklistId);
    const valid = doc && doc.isActive && !doc.archivedAt && doc.pdfUrl;

    const status: ChecklistDownloadStatus = valid ? "success" : "failed";
    const logPayload: Record<string, unknown> = {
      checklistType: doc?.type ?? "Unknown",
      name: input.name,
      phone: input.phone,
      status,
      ...input.geo,
    };
    if (doc) logPayload.checklistId = doc._id;
    if (!valid) {
      logPayload.failureReason = !doc
        ? "Checklist not found"
        : !doc.isActive || doc.archivedAt
          ? "Checklist inactive"
          : "No PDF attached";
    }
    await this.logs.create(logPayload);

    if (!valid) return null;
    return { pdfUrl: doc.pdfUrl! };
  }

  async listLogs(
    options: PaginationOptions,
    status?: ChecklistDownloadStatus,
  ): Promise<PaginatedResult<ChecklistDownloadLog>> {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.logs.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.logs.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toChecklistDownloadLogDTO), total, options);
  }
}
