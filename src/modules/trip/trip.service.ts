import { Types } from "mongoose";
import { BaseService } from "../../core/base/base.service";
import { ConflictError, NotFoundError } from "../../core/errors";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { TripRepository } from "./trip.repository";
import { toTripDTO, type CreateTripInput, type Trip, type UpdateTripInput } from "./trip.types";
import type { TripImage } from "./trip.model";
import { requireSlug } from "../../core/utils/slug.util";
import { hardDeleteFile } from "../../core/utils/uploads";

export interface TripListFilters {
  kind?: "trek" | "tour";
  country?: string;
  region?: string;
  /** Multi-select region filter (OR semantics). Takes precedence over `region`. */
  regions?: string[];
  cat?: string;
  /** Multi-select category filter (OR semantics). Takes precedence over `cat`. */
  cats?: string[];
  minDays?: number;
  maxDays?: number;
  /** Duration bucket keys ("d1"|"d2"|"d3", OR semantics) — matches the frontend's checkbox
   *  filter, which lets a user select non-contiguous buckets (e.g. d1 + d3, skipping d2).
   *  Takes precedence over minDays/maxDays when present. */
  durationBuckets?: string[];
  /** Numeric price range — matched against `price` after stripping comma separators. */
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  /** "live" (default), "archived", or "all" — gates by archive state. */
  state?: "live" | "archived" | "all";
}

export interface TripFacets {
  regions: Record<string, number>;
  durations: Record<string, number>;
}

/** Duration bucket ranges — kept in sync with the frontend's `durBucket()`
 *  (`src/components/sections/ToursListing.tsx`) and `TripRepository`'s facet boundaries. */
const DURATION_BUCKET_RANGES: Record<string, Record<string, number>> = {
  d1: { $gte: 0, $lte: 3 },
  d2: { $gte: 4, $lte: 7 },
  d3: { $gte: 8 },
};

const STATE_FILTER: Record<NonNullable<TripListFilters["state"]>, Record<string, unknown>> = {
  live: { archivedAt: null },
  archived: { archivedAt: { $ne: null } },
  all: {},
};

const isPublished = (doc: { isActive: boolean; archivedAt?: Date | null }): boolean =>
  doc.isActive && !doc.archivedAt;

// Records created before `country` was introduced are Nepal packages.
const countryFilter = (country: string): unknown =>
  country === "nepal" ? { $in: ["nepal", null] } : country;

export class TripService extends BaseService<TripRepository> {
  async list(
    options: PaginationOptions,
    filters: TripListFilters = {},
  ): Promise<PaginatedResult<Trip>> {
    const state = filters.state ?? "live";
    const filter: Record<string, unknown> = { ...STATE_FILTER[state] };
    if (filters.kind) filter.kind = filters.kind;
    if (filters.country) filter.country = countryFilter(filters.country);
    if (filters.region) filter.region = filters.region;
    if (filters.cat) filter.cats = { $in: [filters.cat] };
    if (filters.isActive !== undefined) filter.isActive = filters.isActive;
    if (options.search) {
      const safe = escapeRegex(options.search);
      filter.$or = [
        { title: { $regex: safe, $options: "i" } },
        { sub: { $regex: safe, $options: "i" } },
        { country: { $regex: safe, $options: "i" } },
        { region: { $regex: safe, $options: "i" } },
      ];
    }

    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };

    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, { skip: options.skip, limit: options.limit, sort }),
      this.repository.count(filter),
    ]);

    return PaginationBuilder.build(docs.map(toTripDTO), total, options);
  }

  /**
   * Public listing with server-side region/duration/price filters and facet
   * counts, so the tours page never has to filter a pre-fetched array
   * client-side. See `TripRepository.aggregateFacets` for the "exclude own
   * dimension" facet logic.
   */
  async listWithFacets(
    options: PaginationOptions,
    filters: TripListFilters = {},
  ): Promise<PaginatedResult<Trip> & { facets: TripFacets }> {
    const state = filters.state ?? "live";
    const base: Record<string, unknown> = { ...STATE_FILTER[state] };
    if (filters.kind) base.kind = filters.kind;
    if (filters.country) base.country = countryFilter(filters.country);
    if (filters.cats?.length) base.cats = { $in: filters.cats };
    else if (filters.cat) base.cats = { $in: [filters.cat] };
    if (filters.isActive !== undefined) base.isActive = filters.isActive;
    if (options.search) {
      const safe = escapeRegex(options.search);
      base.$or = [
        { title: { $regex: safe, $options: "i" } },
        { sub: { $regex: safe, $options: "i" } },
        { country: { $regex: safe, $options: "i" } },
        { region: { $regex: safe, $options: "i" } },
      ];
    }

    const regionMatch: Record<string, unknown> = filters.regions?.length
      ? { region: { $in: filters.regions } }
      : filters.region
        ? { region: filters.region }
        : {};

    const durationMatch: Record<string, unknown> = {};
    if (filters.durationBuckets?.length) {
      const ranges = filters.durationBuckets
        .map((b) => DURATION_BUCKET_RANGES[b])
        .filter((r): r is Record<string, number> => Boolean(r));
      if (ranges.length) durationMatch.$or = ranges.map((days) => ({ days }));
    } else if (filters.minDays !== undefined || filters.maxDays !== undefined) {
      const days: Record<string, number> = {};
      if (filters.minDays !== undefined) days.$gte = filters.minDays;
      if (filters.maxDays !== undefined) days.$lte = filters.maxDays;
      durationMatch.days = days;
    }

    const priceMatch: Record<string, unknown> = {};
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const range: Record<string, number> = {};
      if (filters.minPrice !== undefined) range.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) range.$lte = filters.maxPrice;
      priceMatch._priceNum = range;
    }

    // `price` is a display string ("1,390") — sorting it directly is lexical
    // ("990" > "1,390"), so sort on the numeric field the pipeline derives.
    const sortField = options.sortBy === "price" ? "_priceNum" : options.sortBy;
    const sort: Record<string, 1 | -1> = {
      [sortField]: options.sortOrder === "asc" ? 1 : -1,
    };

    const [result] = await this.repository.aggregateFacets({
      base,
      priceMatch,
      regionMatch,
      durationMatch,
      sort,
      skip: options.skip,
      limit: options.limit,
    });

    const docs = result?.data ?? [];
    const total = result?.totalCount?.[0]?.count ?? 0;

    const regions: Record<string, number> = {};
    for (const r of result?.regionFacet ?? []) regions[r._id] = r.count;

    const durations: Record<string, number> = {};
    for (const d of result?.durationFacet ?? []) {
      durations[TripRepository.durationBucketKey(d._id)] = d.count;
    }

    const { data, meta } = PaginationBuilder.build(docs.map(toTripDTO), total, options);
    return { data, meta, facets: { regions, durations } };
  }

  async findById(id: string): Promise<Trip> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    return toTripDTO(doc);
  }

  async findBySlug(slug: string): Promise<Trip> {
    const doc = await this.repository.findBySlug(slug);
    if (!doc) throw new NotFoundError(`Trip ${slug} not found`);
    return toTripDTO(doc);
  }

  /** Public lookups — inactive/archived trips are indistinguishable from missing ones. */
  async findPublishedById(id: string): Promise<Trip> {
    const doc = await this.repository.findById(id);
    if (!doc || !isPublished(doc)) throw new NotFoundError(`Trip ${id} not found`);
    return toTripDTO(doc);
  }

  async findPublishedBySlug(slug: string): Promise<Trip> {
    const doc = await this.repository.findBySlug(slug);
    if (!doc || !isPublished(doc)) throw new NotFoundError(`Trip ${slug} not found`);
    return toTripDTO(doc);
  }

  async create(input: CreateTripInput, createdBy?: string): Promise<Trip> {
    const slug = requireSlug(input.slug || input.title);
    const existing = await this.repository.findBySlug(slug);
    if (existing) throw new ConflictError(`Trip with slug "${slug}" already exists`);

    const payload: Record<string, unknown> = {
      title: input.title.trim(),
      slug,
      kind: input.kind,
      country: input.country.trim().toLowerCase(),
      region: input.region.trim(),
      days: input.days,
    };
    if (input.regionL !== undefined) payload.regionL = input.regionL;
    if (input.cats !== undefined) payload.cats = input.cats;
    if (input.maxAlt !== undefined) payload.maxAlt = input.maxAlt;
    if (input.diff !== undefined) payload.diff = input.diff;
    if (input.season !== undefined) payload.season = input.season;
    if (input.group !== undefined) payload.group = input.group;
    if (input.price !== undefined) payload.price = input.price;
    if (input.was !== undefined) payload.was = input.was;
    if (input.rating !== undefined) payload.rating = input.rating;
    if (input.reviews !== undefined) payload.reviews = input.reviews;
    if (input.badge !== undefined) payload.badge = input.badge;
    if (input.sub !== undefined) payload.sub = input.sub;
    if (input.img !== undefined) payload.img = input.img;
    if (input.overview !== undefined) payload.overview = input.overview;
    if (input.highlights !== undefined) payload.highlights = input.highlights;
    if (input.videoUrl !== undefined) payload.videoUrl = input.videoUrl;
    if (input.inc !== undefined) payload.inc = input.inc;
    if (input.exc !== undefined) payload.exc = input.exc;
    if (input.gallery !== undefined) payload.gallery = input.gallery;
    if (input.altitude !== undefined) payload.altitude = input.altitude;
    if (input.itin !== undefined) payload.itin = input.itin;
    if (input.isActive !== undefined) payload.isActive = input.isActive;
    if (input.isFeatured !== undefined) payload.isFeatured = input.isFeatured;
    if (createdBy) payload.createdBy = new Types.ObjectId(createdBy);

    const doc = await this.repository.create(payload as never);
    return toTripDTO(doc);
  }

  async update(id: string, input: UpdateTripInput): Promise<Trip> {
    const next: Record<string, unknown> = {};
    if (input.title) next.title = input.title.trim();
    if (input.slug) {
      const slug = requireSlug(input.slug);
      const clash = await this.repository.findBySlug(slug);
      if (clash && clash._id.toString() !== id) {
        throw new ConflictError(`Trip with slug "${slug}" already exists`);
      }
      next.slug = slug;
    }
    if (input.kind !== undefined) next.kind = input.kind;
    if (input.country !== undefined) next.country = input.country.trim().toLowerCase();
    if (input.region !== undefined) next.region = input.region.trim();
    if (input.regionL !== undefined) next.regionL = input.regionL;
    if (input.cats !== undefined) next.cats = input.cats;
    if (input.days !== undefined) next.days = input.days;
    if (input.maxAlt !== undefined) next.maxAlt = input.maxAlt;
    if (input.diff !== undefined) next.diff = input.diff;
    if (input.season !== undefined) next.season = input.season;
    if (input.group !== undefined) next.group = input.group;
    if (input.price !== undefined) next.price = input.price;
    if (input.was !== undefined) next.was = input.was;
    if (input.rating !== undefined) next.rating = input.rating;
    if (input.reviews !== undefined) next.reviews = input.reviews;
    if (input.badge !== undefined) next.badge = input.badge;
    if (input.sub !== undefined) next.sub = input.sub;
    if (input.img !== undefined) next.img = input.img;
    if (input.overview !== undefined) next.overview = input.overview;
    if (input.highlights !== undefined) next.highlights = input.highlights;
    if (input.videoUrl !== undefined) next.videoUrl = input.videoUrl;
    if (input.inc !== undefined) next.inc = input.inc;
    if (input.exc !== undefined) next.exc = input.exc;
    if (input.gallery !== undefined) next.gallery = input.gallery;
    if (input.altitude !== undefined) next.altitude = input.altitude;
    if (input.itin !== undefined) next.itin = input.itin;
    if (input.isActive !== undefined) next.isActive = input.isActive;
    if (input.isFeatured !== undefined) next.isFeatured = input.isFeatured;

    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    return toTripDTO(doc);
  }

  /**
   * Archive — hides from public site, can be restored via unarchive().
   */
  async archive(id: string): Promise<Trip> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toTripDTO(doc);
  }

  async unarchive(id: string): Promise<Trip> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    doc.archivedAt = null;
    await doc.save();
    return toTripDTO(doc);
  }

  /**
   * Hard delete — permanently remove the doc and its image files.
   */
  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    for (const img of doc.images) {
      const removed = await hardDeleteFile(img.path, "image");
      if (!removed) {
        this.logger.warn("Failed to delete trip image from Cloudinary", {
          tripId: id,
          publicId: img.path,
        });
      }
    }
    await this.repository.delete(id);
  }

  /** @deprecated Alias for hardDelete(). Kept for back-compat. */
  async delete(id: string): Promise<void> {
    await this.hardDelete(id);
  }

  async addImages(id: string, images: TripImage[]): Promise<Trip> {
    const doc = await this.repository.addImages(id, images);
    if (!doc) {
      // Files were uploaded but no trip matched — clean up so we don't leak storage.
      for (const img of images) await hardDeleteFile(img.path, "image");
      throw new NotFoundError(`Trip ${id} not found`);
    }
    return toTripDTO(doc);
  }

  async removeImage(id: string, imagePath: string): Promise<Trip> {
    // Verify ownership first — otherwise any Cloudinary public_id (another
    // module's asset) could be passed in and permanently deleted.
    await this.requireImage(id, imagePath);
    const doc = await this.repository.removeImage(id, imagePath);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    await hardDeleteFile(imagePath, "image");
    return toTripDTO(doc);
  }

  async setPrimaryImage(id: string, imagePath: string): Promise<Trip> {
    await this.requireImage(id, imagePath);
    const doc = await this.repository.setPrimaryImage(id, imagePath);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    return toTripDTO(doc);
  }

  async updateImageAlt(id: string, imagePath: string, alt: string): Promise<Trip> {
    const doc = await this.repository.updateImageAlt(id, imagePath, alt);
    if (doc === null) throw new NotFoundError(`Trip ${id} not found`);
    if (doc === undefined) throw new NotFoundError(`Image not found on trip ${id}`);
    return toTripDTO(doc);
  }

  async reorderImages(id: string, order: string[]): Promise<Trip> {
    const doc = await this.repository.reorderImages(id, order);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    return toTripDTO(doc);
  }

  private async requireImage(id: string, imagePath: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    if (!doc.images.some((img) => img.path === imagePath)) {
      throw new NotFoundError(`Image not found on trip ${id}`);
    }
  }

  async getRaw(id: string) {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Trip ${id} not found`);
    return doc;
  }
}
