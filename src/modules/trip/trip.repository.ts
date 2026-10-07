import type { HydratedDocument, PipelineStage } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { TripModel, type TripDoc, type TripImage } from "./trip.model";

/** Duration bucket boundaries shared with the frontend's `durBucket()` — keep in sync. */
const DURATION_BOUNDARIES = [0, 4, 8, Number.MAX_SAFE_INTEGER];
const DURATION_BUCKET_KEYS: Record<number, string> = { 0: "d1", 4: "d2", 8: "d3" };

export interface TripFacetParams {
  /** Filters shared by every facet branch (kind, cats, price range, search, state). */
  base: Record<string, unknown>;
  /** `{ _priceNum: { $gte, $lte } }` applied right after price is derived from the string field. */
  priceMatch: Record<string, unknown>;
  /** Region-only filter, applied to every branch except the region facet itself. */
  regionMatch: Record<string, unknown>;
  /** Duration-only filter, applied to every branch except the duration facet itself. */
  durationMatch: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
}

export interface TripFacetResult {
  data: HydratedDocument<TripDoc>[];
  totalCount: { count: number }[];
  regionFacet: { _id: string; count: number }[];
  durationFacet: { _id: number | string; count: number }[];
}

export class TripRepository extends BaseRepository<TripDoc> {
  constructor() {
    super(TripModel);
  }

  async findBySlug(slug: string): Promise<HydratedDocument<TripDoc> | null> {
    return this.model.findOne({ slug });
  }

  /**
   * One aggregation covering: filtered+paginated results, matching total, and
   * region/duration facet counts. Each facet branch applies every filter
   * EXCEPT its own dimension, so counts always reflect what selecting that
   * option would actually return (standard faceted-search behaviour).
   *
   * `price` is stored as a display string (e.g. "1,390"), so it's converted
   * to a number here rather than indexed — fine at this catalog's size.
   */
  async aggregateFacets(params: TripFacetParams): Promise<TripFacetResult[]> {
    const pipeline: PipelineStage[] = [
      { $match: params.base },
      {
        $addFields: {
          _priceNum: {
            $convert: {
              input: {
                $replaceAll: { input: { $ifNull: ["$price", "0"] }, find: ",", replacement: "" },
              },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
    ];
    if (Object.keys(params.priceMatch).length > 0) {
      pipeline.push({ $match: params.priceMatch });
    }

    pipeline.push({
      $facet: {
        data: [
          { $match: { ...params.regionMatch, ...params.durationMatch } },
          { $sort: params.sort },
          { $skip: params.skip },
          { $limit: params.limit },
        ],
        totalCount: [
          { $match: { ...params.regionMatch, ...params.durationMatch } },
          { $count: "count" },
        ],
        regionFacet: [
          { $match: params.durationMatch },
          { $group: { _id: "$region", count: { $sum: 1 } } },
        ],
        durationFacet: [
          { $match: params.regionMatch },
          {
            $bucket: {
              groupBy: "$days",
              boundaries: DURATION_BOUNDARIES,
              default: "other",
              output: { count: { $sum: 1 } },
            },
          },
        ],
      },
    });

    return this.model.aggregate<TripFacetResult>(pipeline);
  }

  static durationBucketKey(lowerBoundary: number | string): string {
    if (typeof lowerBoundary === "string") return lowerBoundary;
    return DURATION_BUCKET_KEYS[lowerBoundary] ?? "other";
  }

  async addImages(id: string, images: TripImage[]): Promise<HydratedDocument<TripDoc> | null> {
    return this.model.findByIdAndUpdate(
      id,
      { $push: { images: { $each: images } } },
      { new: true },
    );
  }

  async removeImage(id: string, path: string): Promise<HydratedDocument<TripDoc> | null> {
    return this.model.findByIdAndUpdate(id, { $pull: { images: { path } } }, { new: true });
  }

  /**
   * Update the alt text of a single image, addressed by its `path`. Returns
   * `null` for a missing trip, `undefined` for a trip whose images don't
   * include `path` — kept distinct so the service can raise the right
   * NotFoundError message for each case.
   */
  async updateImageAlt(
    id: string,
    path: string,
    alt: string,
  ): Promise<HydratedDocument<TripDoc> | null | undefined> {
    const doc = await this.model.findById(id);
    if (!doc) return null;
    const img = doc.images.find((i) => i.path === path);
    if (!img) return undefined;
    img.alt = alt;
    await doc.save();
    return doc;
  }

  async setPrimaryImage(id: string, path: string): Promise<HydratedDocument<TripDoc> | null> {
    const doc = await this.model.findById(id);
    if (!doc) return null;
    doc.images = doc.images.map((img) => ({ ...img, isPrimary: img.path === path }));
    await doc.save();
    return doc;
  }

  async reorderImages(id: string, order: string[]): Promise<HydratedDocument<TripDoc> | null> {
    const doc = await this.model.findById(id);
    if (!doc) return null;
    const byPath = new Map(doc.images.map((img) => [img.path, img]));
    const next: TripImage[] = [];
    for (const path of order) {
      const img = byPath.get(path);
      if (img) {
        next.push(img);
        byPath.delete(path);
      }
    }
    // Append any images the caller didn't include so we never silently drop data.
    for (const remaining of byPath.values()) next.push(remaining);
    // First image becomes primary so reordering controls the public thumbnail.
    doc.images = next.map((img, i) => ({ ...img, isPrimary: i === 0 }));
    await doc.save();
    return doc;
  }
}
