import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { fileToRecord, hardDeleteFile } from "../../core/utils/uploads";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { PartnerRepository } from "./partner.repository";
import {
  toPartnerDTO,
  type Partner,
  type CreatePartnerInput,
  type UpdatePartnerInput,
} from "./partner.types";

export class PartnerService extends BaseService<PartnerRepository> {
  async list(
    options: PaginationOptions,
    state: "live" | "archived" | "all" = "live",
  ): Promise<PaginatedResult<Partner>> {
    const filter: Record<string, unknown> = {};
    if (state === "live") {
      filter.archivedAt = null;
    } else if (state === "archived") {
      filter.archivedAt = { $ne: null };
    }
    if (options.search) filter.name = { $regex: escapeRegex(options.search), $options: "i" };
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toPartnerDTO), total, options);
  }

  /** Public listing — only active, non-archived partners. */
  async listPublic(options: PaginationOptions): Promise<PaginatedResult<Partner>> {
    const filter = { isActive: true, archivedAt: null };
    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toPartnerDTO), total, options);
  }

  async listAll(): Promise<Partner[]> {
    const docs = await this.repository.findAll(
      { isActive: true, archivedAt: null },
      { sort: { sortOrder: 1 } },
    );
    return docs.map(toPartnerDTO);
  }

  async findById(id: string): Promise<Partner> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Partner ${id} not found`);
    return toPartnerDTO(doc);
  }

  async create(input: CreatePartnerInput): Promise<Partner> {
    const payload: Partial<CreatePartnerInput> & { name: string } = {
      name: input.name.trim(),
    };
    if (input.url !== undefined) payload.url = input.url;
    if (input.logoUrl !== undefined) payload.logoUrl = input.logoUrl;
    if (input.isActive !== undefined) payload.isActive = input.isActive;
    if (input.sortOrder !== undefined) payload.sortOrder = input.sortOrder;
    const doc = await this.repository.create(payload);
    return toPartnerDTO(doc);
  }

  async update(id: string, input: UpdatePartnerInput): Promise<Partner> {
    const next: Record<string, unknown> = { ...input };
    if (input.name) next.name = input.name.trim();
    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Partner ${id} not found`);
    return toPartnerDTO(doc);
  }

  async archive(id: string): Promise<Partner> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Partner ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toPartnerDTO(doc);
  }

  async unarchive(id: string): Promise<Partner> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Partner ${id} not found`);
    doc.archivedAt = null;
    await doc.save();
    return toPartnerDTO(doc);
  }

  async uploadImage(id: string, file: Express.Multer.File): Promise<Partner> {
    const record = fileToRecord("partner", file);
    const doc = await this.repository.findById(id);
    if (!doc) {
      await hardDeleteFile(record.publicId, "image");
      throw new NotFoundError(`Partner ${id} not found`);
    }
    // If a previous logo exists, permanently delete it before replacing.
    if (doc.logoPath) await hardDeleteFile(doc.logoPath, "image");
    doc.logoPath = record.publicId;
    doc.logoUrl = record.url;
    await doc.save();
    return toPartnerDTO(doc);
  }

  async removeImage(id: string): Promise<Partner> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Partner ${id} not found`);
    if (doc.logoPath) await hardDeleteFile(doc.logoPath, "image");
    doc.logoPath = undefined as unknown as string;
    doc.logoUrl = undefined as unknown as string;
    await doc.save();
    return toPartnerDTO(doc);
  }

  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Partner ${id} not found`);
    if (doc.logoPath) await hardDeleteFile(doc.logoPath, "image");
    await this.repository.delete(id);
  }
}
