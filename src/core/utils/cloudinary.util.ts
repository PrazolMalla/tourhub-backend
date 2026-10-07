import type { Readable } from "stream";
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../config/cloudinary";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export type CloudinaryResourceType = "image" | "video" | "raw";

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  resourceType: CloudinaryResourceType;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  /** Video only. */
  duration?: number;
}

const toResult = (res: UploadApiResponse): CloudinaryUploadResult => {
  const result: CloudinaryUploadResult = {
    publicId: res.public_id,
    url: res.url,
    secureUrl: res.secure_url,
    resourceType: res.resource_type as CloudinaryResourceType,
    format: res.format,
    bytes: res.bytes,
  };
  if (res.width !== undefined) result.width = res.width;
  if (res.height !== undefined) result.height = res.height;
  if (res.duration !== undefined) result.duration = res.duration;
  return result;
};

const isReadableStream = (input: unknown): input is Readable =>
  typeof input === "object" && input !== null && typeof (input as Readable).pipe === "function";

/**
 * Upload a local file path, an in-memory buffer, or a readable stream to
 * Cloudinary, under `CLOUDINARY_FOLDER` (optionally nested via
 * `options.folder`, e.g. "trips" → "yatranepaltours/trips").
 *
 * Streams are piped straight into `upload_stream` — no full-buffer step —
 * so large files (video) get real backpressure instead of being loaded
 * entirely into memory first.
 */
export const uploadToCloudinary = (
  input: string | Buffer | Readable,
  resourceType: CloudinaryResourceType,
  options: Partial<UploadApiOptions> = {},
): Promise<CloudinaryUploadResult> => {
  const folder = options.folder
    ? `${env.CLOUDINARY_FOLDER}/${options.folder}`
    : env.CLOUDINARY_FOLDER;

  const uploadOptions: UploadApiOptions = {
    ...options,
    folder,
    resource_type: resourceType,
  };

  if (typeof input === "string") {
    return cloudinary.uploader.upload(input, uploadOptions).then(toResult);
  }

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, res) => {
      if (err || !res) {
        reject(err ?? new Error("Cloudinary upload returned no result"));
        return;
      }
      resolve(toResult(res));
    });
    if (isReadableStream(input)) {
      input.pipe(stream);
    } else {
      stream.end(input);
    }
  });
};

export const uploadImageToCloudinary = (
  input: string | Buffer | Readable,
  options: Partial<UploadApiOptions> = {},
): Promise<CloudinaryUploadResult> => uploadToCloudinary(input, "image", options);

export const uploadVideoToCloudinary = (
  input: string | Buffer | Readable,
  options: Partial<UploadApiOptions> = {},
): Promise<CloudinaryUploadResult> => uploadToCloudinary(input, "video", options);

export const uploadDocumentToCloudinary = (
  input: string | Buffer | Readable,
  options: Partial<UploadApiOptions> = {},
): Promise<CloudinaryUploadResult> => uploadToCloudinary(input, "raw", options);

/** Delete a previously uploaded asset. `resourceType` must match what it was uploaded as. */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: CloudinaryResourceType = "image",
): Promise<boolean> => {
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return res.result === "ok";
  } catch (err) {
    logger.warn("deleteFromCloudinary failed", { publicId, resourceType, err: String(err) });
    return false;
  }
};

/**
 * Cloudinary auto-format/auto-quality delivery URL for an already-uploaded
 * asset — computed on read, never persisted. Lets us change the
 * transformation later (quality, explicit webp, width cap) in one place
 * instead of needing a data migration for stored URLs.
 */
export const cloudinaryAutoUrl = (publicId: string): string =>
  cloudinary.url(publicId, { secure: true, fetch_format: "auto", quality: "auto" });

/**
 * Best-effort factory-reset helper: deletes every asset under
 * `CLOUDINARY_FOLDER` across all resource types. Not guaranteed-exhaustive
 * past Cloudinary's per-call bulk-delete cap, which is fine at this site's
 * scale (SuperAdmin-only, rarely used "clear database" action).
 */
export const wipeCloudinaryFolder = async (): Promise<{
  deletedByType: Record<string, number>;
}> => {
  const prefix = `${env.CLOUDINARY_FOLDER}/`;
  const deletedByType: Record<string, number> = {};
  for (const resourceType of ["image", "video", "raw"] as const) {
    try {
      const res = await cloudinary.api.delete_resources_by_prefix(prefix, {
        resource_type: resourceType,
      });
      deletedByType[resourceType] = Object.keys(res.deleted ?? {}).length;
    } catch (err) {
      logger.warn("wipeCloudinaryFolder: delete_resources_by_prefix failed", {
        resourceType,
        err: String(err),
      });
      deletedByType[resourceType] = 0;
    }
  }
  return { deletedByType };
};
