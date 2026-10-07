import { Types } from "mongoose";
import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { BannerRepository, type BannerState } from "./banner.repository";
import {
  toBannerDTO,
  type BannerDTO,
  type CreateBannerInput,
  type UpdateBannerInput,
} from "./banner.types";
import type { BannerSection } from "./banner.model";
import { hardDeleteFile, subDirForKind, type UploadKind } from "../../core/utils/uploads";
import { uploadImageToCloudinary } from "../../core/utils/cloudinary.util";

/**
 * A banner's image lives under Cloudinary's landing-banners/about-banners/...
 * subfolder. The folder is derived from the banner's section — the file
 * comes in as a plain in-memory buffer (not pre-uploaded by multer), since
 * the correct destination isn't known until body validation has confirmed
 * `section`.
 */
const uploadKindForSection = (section: BannerSection): UploadKind => {
  if (section === "landing") return "landing-banner";
  if (section === "about") return "about-banner";
  // Other sections share the generic site-content folder — they are rarer.
  return "site-content";
};

export class BannerService extends BaseService<BannerRepository> {
  async listPublic(section: BannerSection): Promise<BannerDTO[]> {
    const docs = await this.repository.listPublic(section);
    return docs.map(toBannerDTO);
  }

  async listAdmin(opts: { section?: BannerSection; state?: BannerState }): Promise<BannerDTO[]> {
    const state = opts.state ?? "live";
    const docs = opts.section
      ? await this.repository.listBySection(opts.section, state)
      : await this.repository.listAll(state);
    return docs.map(toBannerDTO);
  }

  async findById(id: string): Promise<BannerDTO> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Banner ${id} not found`);
    return toBannerDTO(doc);
  }

  async create(
    input: CreateBannerInput,
    file: Express.Multer.File | undefined,
    createdBy?: string,
  ): Promise<BannerDTO> {
    const payload: Record<string, unknown> = {
      section: input.section,
      title: input.title.trim(),
    };
    if (input.titleAccent !== undefined) payload.titleAccent = input.titleAccent;
    if (input.subtitle !== undefined) payload.subtitle = input.subtitle;
    if (input.eyebrow !== undefined) payload.eyebrow = input.eyebrow;
    if (input.ctaLabel !== undefined) payload.ctaLabel = input.ctaLabel;
    if (input.ctaHref !== undefined) payload.ctaHref = input.ctaHref;
    if (input.ctaSecondaryLabel !== undefined) payload.ctaSecondaryLabel = input.ctaSecondaryLabel;
    if (input.ctaSecondaryHref !== undefined) payload.ctaSecondaryHref = input.ctaSecondaryHref;
    if (input.imageAlt !== undefined) payload.imageAlt = input.imageAlt;
    if (input.style !== undefined) payload.style = input.style;
    if (input.sortOrder !== undefined) payload.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) payload.isActive = input.isActive;
    if (createdBy) payload.createdBy = new Types.ObjectId(createdBy);

    if (file) {
      const result = await uploadImageToCloudinary(file.buffer, {
        folder: subDirForKind(uploadKindForSection(input.section)),
      });
      payload.imagePath = result.publicId;
      payload.imageUrl = result.secureUrl;
    }

    const doc = await this.repository.create(payload as never);
    return toBannerDTO(doc);
  }

  async update(
    id: string,
    input: UpdateBannerInput,
    file: Express.Multer.File | undefined,
  ): Promise<BannerDTO> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError(`Banner ${id} not found`);

    const next: Record<string, unknown> = {};
    if (input.title !== undefined) next.title = input.title.trim();
    if (input.titleAccent !== undefined) next.titleAccent = input.titleAccent;
    if (input.subtitle !== undefined) next.subtitle = input.subtitle;
    if (input.eyebrow !== undefined) next.eyebrow = input.eyebrow;
    if (input.ctaLabel !== undefined) next.ctaLabel = input.ctaLabel;
    if (input.ctaHref !== undefined) next.ctaHref = input.ctaHref;
    if (input.ctaSecondaryLabel !== undefined) next.ctaSecondaryLabel = input.ctaSecondaryLabel;
    if (input.ctaSecondaryHref !== undefined) next.ctaSecondaryHref = input.ctaSecondaryHref;
    if (input.imageAlt !== undefined) next.imageAlt = input.imageAlt;
    if (input.style !== undefined) next.style = input.style;
    if (input.sortOrder !== undefined) next.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) next.isActive = input.isActive;

    if (file) {
      const result = await uploadImageToCloudinary(file.buffer, {
        folder: subDirForKind(uploadKindForSection(existing.section)),
      });
      // Permanently remove the old image — there is no trash to recover it from.
      if (existing.imagePath) await hardDeleteFile(existing.imagePath, "image");
      next.imagePath = result.publicId;
      next.imageUrl = result.secureUrl;
    }

    const doc = await this.repository.update(id, next);
    if (!doc) throw new NotFoundError(`Banner ${id} not found`);
    return toBannerDTO(doc);
  }

  /** Soft-archive: hides from public site but keeps everything intact. */
  async archive(id: string): Promise<BannerDTO> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Banner ${id} not found`);
    doc.archivedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return toBannerDTO(doc);
  }

  /** Move archived banner back to live state. */
  async unarchive(id: string): Promise<BannerDTO> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Banner ${id} not found`);
    doc.archivedAt = null as unknown as Date;
    await doc.save();
    return toBannerDTO(doc);
  }

  /** Hard delete — permanent, removes doc + Cloudinary asset. */
  async hardDelete(id: string): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Banner ${id} not found`);
    if (doc.imagePath) await hardDeleteFile(doc.imagePath, "image");
    await this.repository.delete(id);
  }
}
