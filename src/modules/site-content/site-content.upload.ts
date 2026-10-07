/**
 * @deprecated SiteContent uploads now go through `core/utils/uploads.ts`.
 * This module remains as a thin re-export for back-compat.
 */
import { uploaderFor, fileToRecord } from "../../core/utils/uploads";

// Cap simultaneous uploads to keep the worst-case request size sane:
// 10 files × MAX_UPLOAD_SIZE_MB (default 5) = 50 MB per request.
export const siteContentImageUpload = () => uploaderFor("site-content", 10);

export const siteFileToImage = (file: Express.Multer.File) => fileToRecord("site-content", file);
