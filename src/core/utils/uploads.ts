import multer from "multer";
import type { Request } from "express";
import { env } from "../../config/env";
import { HttpError } from "../errors";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  wipeCloudinaryFolder,
  type CloudinaryResourceType,
  type CloudinaryUploadResult,
} from "./cloudinary.util";

/**
 * Single source of truth for where uploaded files live. Every module routes its
 * multer storage through here so the Cloudinary tree is predictable:
 *
 *   yatranepaltours/
 *     landing-banners/   # hero / promotional banners on the home page
 *     about-banners/     # banners specific to the About page
 *     gallery/           # gallery section images
 *     trips/ blog/ testimonials/ partners/ holidays/ vehicles/ regions/
 *     about-us/          # additional about-page imagery (mission, sourcing…) + team-member photos
 *     site-content/      # legacy: free-form site sections (kept for back-compat)
 *     checklists/        # school-trip-checklist PDFs (resource_type "raw")
 *     seo/               # admin-managed OG / Twitter card images
 */

export type UploadKind =
  | "landing-banner"
  | "about-banner"
  | "gallery"
  | "trip"
  | "blog"
  | "testimonial"
  | "partner"
  | "holiday"
  | "vehicle"
  | "region"
  | "about-us"
  | "site-content"
  | "team-member"
  | "checklist"
  | "seo";

const KIND_TO_SUBDIR: Record<UploadKind, string> = {
  "landing-banner": "landing-banners",
  "about-banner": "about-banners",
  gallery: "gallery",
  trip: "trips",
  blog: "blog",
  testimonial: "testimonials",
  partner: "partners",
  holiday: "holidays",
  vehicle: "vehicles",
  region: "regions",
  "about-us": "about-us",
  "team-member": "about-us",
  seo: "seo",
  "site-content": "site-content",
  checklist: "checklists",
};

export const subDirForKind = (kind: UploadKind): string => KIND_TO_SUBDIR[kind];

/**
 * SVG is intentionally excluded: SVGs can carry inline <script>. If SVG
 * support is ever required, pipe uploads through DOMPurify first.
 */
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export interface UploadedFileRecord {
  /** Cloudinary public_id — required to delete/replace this asset later. */
  publicId: string;
  /** Cloudinary secure delivery URL. */
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadedDocRecord {
  publicId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

/** A multer file enriched by `CloudinaryUploadStorage` with the upload result. */
export type CloudinaryMulterFile = Express.Multer.File & { cloudinary?: CloudinaryUploadResult };

const requireCloudinaryResult = (
  file: Express.Multer.File,
  fnName: string,
): CloudinaryUploadResult => {
  const result = (file as CloudinaryMulterFile).cloudinary;
  if (!result) {
    throw new Error(`${fnName}: file was not routed through CloudinaryUploadStorage`);
  }
  return result;
};

/** Convert a multer file (already uploaded to Cloudinary) into the persistable image record. */
export const fileToRecord = (_kind: UploadKind, file: Express.Multer.File): UploadedFileRecord => {
  const result = requireCloudinaryResult(file, "fileToRecord");
  return {
    publicId: result.publicId,
    url: result.secureUrl,
    mimeType: file.mimetype,
    sizeBytes: result.bytes,
  };
};

/** Convert a plain (non-image) multer file into the persistable doc record. */
export const docFileToRecord = (
  _kind: UploadKind,
  file: Express.Multer.File,
): UploadedDocRecord => {
  const result = requireCloudinaryResult(file, "docFileToRecord");
  return {
    publicId: result.publicId,
    url: result.secureUrl,
    mimeType: file.mimetype,
    sizeBytes: result.bytes,
    originalName: file.originalname,
  };
};

/**
 * Custom multer storage engine that streams the incoming file straight to
 * Cloudinary (no temp file, no local disk write) and attaches the result to
 * `file.cloudinary` so `fileToRecord`/`docFileToRecord` can read it
 * synchronously — mirroring how the old sharp pipeline attached `.optimized`.
 */
class CloudinaryUploadStorage implements multer.StorageEngine {
  constructor(
    private readonly kind: UploadKind,
    private readonly resourceType: CloudinaryResourceType,
  ) {}

  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ): void {
    uploadToCloudinary(file.stream, this.resourceType, { folder: subDirForKind(this.kind) })
      .then((result) => {
        cb(null, {
          filename: result.publicId,
          size: result.bytes,
          path: result.secureUrl,
          cloudinary: result,
        } as Partial<Express.Multer.File> & { cloudinary: CloudinaryUploadResult });
      })
      .catch((err) => cb(err));
  }

  /**
   * Multer calls this to roll back files already uploaded earlier in the
   * same multi-file request when a later file fails validation — without
   * this, a partially-failed `upload.array(...)` leaks orphaned Cloudinary
   * assets silently.
   */
  _removeFile(_req: Request, file: Express.Multer.File, cb: (error: Error | null) => void): void {
    const result = (file as CloudinaryMulterFile).cloudinary;
    if (!result) {
      cb(null);
      return;
    }
    deleteFromCloudinary(result.publicId, this.resourceType)
      .then(() => cb(null))
      .catch((err) => cb(err instanceof Error ? err : new Error(String(err))));
  }
}

/** Multer factory for images — one per upload kind, with per-route file-count caps. */
export const uploaderFor = (kind: UploadKind, maxFiles: number): multer.Multer => {
  const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(HttpError.badRequest(`Unsupported image type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
  return multer({
    storage: new CloudinaryUploadStorage(kind, "image"),
    fileFilter,
    limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: maxFiles },
  });
};

/** Multer factory for video files (resource_type "video"), larger size cap than images. */
export const videoUploaderFor = (kind: UploadKind, maxFiles: number): multer.Multer => {
  const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!ALLOWED_VIDEO_MIME.has(file.mimetype)) {
      cb(HttpError.badRequest(`Unsupported video type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
  return multer({
    storage: new CloudinaryUploadStorage(kind, "video"),
    fileFilter,
    limits: { fileSize: env.MAX_VIDEO_UPLOAD_SIZE_MB * 1024 * 1024, files: maxFiles },
  });
};

/** Multer factory for plain document uploads (PDFs), stored as Cloudinary "raw" resources. */
export const documentUploaderFor = (
  kind: UploadKind,
  maxFiles: number,
  allowedMime: Set<string> = new Set(["application/pdf"]),
): multer.Multer => {
  const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!allowedMime.has(file.mimetype)) {
      cb(HttpError.badRequest(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
  return multer({
    storage: new CloudinaryUploadStorage(kind, "raw"),
    fileFilter,
    limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: maxFiles },
  });
};

/**
 * Plain in-memory buffer uploader — no Cloudinary call at multer time. Used
 * where the destination folder isn't known until after body validation runs
 * (banner: the folder depends on `section`, which multer parses concurrently
 * with the file and can't be trusted to arrive before it).
 */
export const bufferUploaderFor = (maxFiles: number): multer.Multer => {
  const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(HttpError.badRequest(`Unsupported image type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: maxFiles },
  });
};

/** Hard delete a previously uploaded Cloudinary asset. */
export const hardDeleteFile = (
  publicId: string,
  resourceType: CloudinaryResourceType = "image",
): Promise<boolean> => deleteFromCloudinary(publicId, resourceType);

/**
 * Wipe every asset under the managed Cloudinary folder, across every
 * resource type. Used by the SuperAdmin "clear database" flow so Cloudinary
 * doesn't drift from the freshly-emptied Mongo state.
 */
export const wipeAllUploads = async (): Promise<{ filesDeleted: number; subdirs: string[] }> => {
  const { deletedByType } = await wipeCloudinaryFolder();
  const filesDeleted = Object.values(deletedByType).reduce((a, b) => a + b, 0);
  return { filesDeleted, subdirs: Object.values(KIND_TO_SUBDIR) };
};
