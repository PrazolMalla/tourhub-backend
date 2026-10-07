import { BaseService } from "../../core/base/base.service";
import { HttpError, NotFoundError } from "../../core/errors";
import { fileToRecord, hardDeleteFile } from "../../core/utils/uploads";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import { requireSlug } from "../../core/utils/slug.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { VehicleRepository } from "./vehicle.repository";
import {
  toPublicVehicle,
  toVehicleDTO,
  type CreateVehicleInput,
  type PublicVehicle,
  type UpdateVehicleInput,
  type Vehicle,
} from "./vehicle.types";

export class VehicleService extends BaseService<VehicleRepository> {
  async list(
    options: PaginationOptions,
    state: "live" | "archived" | "all" = "live",
  ): Promise<PaginatedResult<Vehicle>> {
    const filter: Record<string, unknown> = {};
    if (state === "live") {
      filter.archivedAt = null;
    } else if (state === "archived") {
      filter.archivedAt = { $ne: null };
    }
    if (options.search) filter.name = { $regex: escapeRegex(options.search), $options: "i" };
    const sort: Record<string, 1 | -1> = { [options.sortBy]: options.sortOrder === "asc" ? 1 : -1 };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toVehicleDTO), total, options);
  }

  /** Public listing — active, live vehicles serialized to the frontend shape. */
  async listPublic(options: PaginationOptions): Promise<PaginatedResult<PublicVehicle>> {
    const filter: Record<string, unknown> = { isActive: true, archivedAt: null };
    if (options.search) filter.name = { $regex: escapeRegex(options.search), $options: "i" };
    const sort: Record<string, 1 | -1> = { [options.sortBy]: options.sortOrder === "asc" ? 1 : -1 };
    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);
    return PaginationBuilder.build(docs.map(toPublicVehicle), total, options);
  }

  async findPublicBySlug(slug: string): Promise<PublicVehicle> {
    const doc = await this.repository.findBySlug(slug);
    if (!doc || !doc.isActive || doc.archivedAt)
      throw new NotFoundError(`Vehicle "${slug}" not found`);
    return toPublicVehicle(doc);
  }

  async findById(id: string): Promise<Vehicle> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Vehicle ${id} not found`);
    return toVehicleDTO(doc);
  }

  async create(input: CreateVehicleInput): Promise<Vehicle> {
    const slug = requireSlug(input.slug || input.name);
    const existing = await this.repository.findOne({ slug });
    if (existing) throw HttpError.conflict(`A vehicle with slug "${slug}" already exists`);
    const payload: Record<string, unknown> = {
      slug,
      name: input.name.trim(),
      tag: input.tag ?? "",
      desc: input.desc ?? "",
      specs: input.specs ?? [],
      overview: input.overview ?? [],
      features: input.features ?? [],
      facts: input.facts ?? [],
      gallery: input.gallery ?? [],
      isActive: input.isActive ?? true,
      isFeatured: input.isFeatured ?? false,
      sortOrder: input.sortOrder ?? 0,
    };
    if (input.img !== undefined) payload.img = input.img;
    const doc = await this.repository.create(
      payload as Parameters<typeof this.repository.create>[0],
    );
    return toVehicleDTO(doc);
  }

  async update(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const next: Record<string, unknown> = { ...input };
    if (input.name) next.name = input.name.trim();
    if (input.slug) next.slug = requireSlug(input.slug);
    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Vehicle ${id} not found`);
    return toVehicleDTO(doc);
  }

  async archive(id: string): Promise<Vehicle> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Vehicle ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toVehicleDTO(doc);
  }

  async unarchive(id: string): Promise<Vehicle> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Vehicle ${id} not found`);
    doc.archivedAt = null;
    await doc.save();
    return toVehicleDTO(doc);
  }

  async uploadImage(id: string, file: Express.Multer.File): Promise<Vehicle> {
    const record = fileToRecord("vehicle", file);
    const doc = await this.repository.findById(id);
    if (!doc) {
      await hardDeleteFile(record.publicId, "image");
      throw new NotFoundError(`Vehicle ${id} not found`);
    }
    // Replacing the image — delete the previous asset so it doesn't leak.
    for (const img of doc.images) await hardDeleteFile(img.path, "image");
    doc.images = [
      {
        path: record.publicId,
        url: record.url,
        isPrimary: true,
        sizeBytes: record.sizeBytes,
        mimeType: record.mimeType,
      },
    ];
    await doc.save();
    return toVehicleDTO(doc);
  }

  async removeImage(id: string): Promise<Vehicle> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Vehicle ${id} not found`);
    for (const img of doc.images) await hardDeleteFile(img.path, "image");
    doc.images = [];
    await doc.save();
    return toVehicleDTO(doc);
  }

  /** Only ever one image (upload replaces it), so no `path` needed to address it. */
  async updateImageAlt(id: string, alt: string): Promise<Vehicle> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Vehicle ${id} not found`);
    const img = doc.images[0];
    if (!img) throw new NotFoundError(`Vehicle ${id} has no image`);
    img.alt = alt;
    await doc.save();
    return toVehicleDTO(doc);
  }

  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Vehicle ${id} not found`);
    for (const img of doc.images) await hardDeleteFile(img.path, "image");
    await this.repository.delete(id);
  }
}
