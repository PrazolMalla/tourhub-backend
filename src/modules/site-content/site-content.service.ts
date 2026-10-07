import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { SiteContentRepository } from "./site-content.repository";
import {
  toSiteContentDTO,
  toPublicSiteContentDTO,
  SITE_CONTENT_DEFAULTS,
  type SiteContentDTO,
  type UpsertSiteContentInput,
} from "./site-content.types";
import type { SiteImage } from "./site-content.model";
import { hardDeleteFile } from "../../core/utils/uploads";
import { logger } from "../../config/logger";

export class SiteContentService extends BaseService<SiteContentRepository> {
  /** Public read — falls back to bundled defaults if section is missing or unpublished. */
  async getPublic(section: string): Promise<SiteContentDTO> {
    const doc = await this.repository.findBySection(section);
    // Defense-in-depth: archive() already flips isPublished to false, but
    // checking the lifecycle flag explicitly means a hand-edited DB (or a
    // future code path) can't accidentally leak an archived doc.
    if (doc && doc.isPublished && !doc.archivedAt) {
      return toPublicSiteContentDTO(doc);
    }
    const fallback = SITE_CONTENT_DEFAULTS[section.toLowerCase()] ?? {};
    return {
      id: "default",
      section: section.toLowerCase(),
      data: fallback,
      images: [],
      isPublished: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  }

  /** Admin read — never falls back; surfaces unpublished too. */
  async getAdmin(section: string): Promise<SiteContentDTO> {
    const doc = await this.repository.findBySection(section);
    if (!doc) {
      // create an empty record so the admin form has something to bind to
      const data = SITE_CONTENT_DEFAULTS[section.toLowerCase()] ?? {};
      const created = await this.repository.upsertBySection(section, {
        data,
        images: [],
        isPublished: false,
      });
      return toSiteContentDTO(created);
    }
    return toSiteContentDTO(doc);
  }

  async listAllAdmin(): Promise<SiteContentDTO[]> {
    const docs = await this.repository.listAll();
    return docs.map(toSiteContentDTO);
  }

  async listAllPublic(): Promise<SiteContentDTO[]> {
    const docs = await this.repository.listAllPublished();
    return docs.map(toPublicSiteContentDTO);
  }

  async upsert(section: string, input: UpsertSiteContentInput): Promise<SiteContentDTO> {
    const update: Record<string, unknown> = {};
    if (input.data !== undefined) update.data = input.data;
    if (input.isPublished !== undefined) update.isPublished = input.isPublished;
    if (input.notes !== undefined) update.notes = input.notes;
    const doc = await this.repository.upsertBySection(section, update);
    return toSiteContentDTO(doc);
  }

  async addImages(section: string, images: SiteImage[]): Promise<SiteContentDTO> {
    const existing = await this.repository.findBySection(section);
    const merged = [...(existing?.images ?? []), ...images];
    const doc = await this.repository.upsertBySection(section, { images: merged });
    return toSiteContentDTO(doc);
  }

  async reorderImages(section: string, order: string[]): Promise<SiteContentDTO> {
    const doc = await this.repository.findBySection(section);
    if (!doc) throw new NotFoundError(`Section "${section}" not found`);
    const index = new Map(order.map((p, i) => [p, i]));
    const reordered = [...doc.images].sort(
      (a, b) => (index.get(a.path) ?? 9999) - (index.get(b.path) ?? 9999),
    );
    reordered.forEach((img, i) => {
      img.sortOrder = i;
    });
    doc.images = reordered;
    await doc.save();
    return toSiteContentDTO(doc);
  }

  async updateImageMeta(
    section: string,
    imagePath: string,
    meta: { alt?: string; caption?: string },
  ): Promise<SiteContentDTO> {
    const doc = await this.repository.findBySection(section);
    if (!doc) throw new NotFoundError(`Section "${section}" not found`);
    const img = doc.images.find((i) => i.path === imagePath);
    if (!img) throw new NotFoundError(`Image not found in section`);
    if (meta.alt !== undefined) img.alt = meta.alt;
    if (meta.caption !== undefined) img.caption = meta.caption;
    await doc.save();
    return toSiteContentDTO(doc);
  }

  async removeImage(section: string, imagePath: string): Promise<SiteContentDTO> {
    const doc = await this.repository.findBySection(section);
    if (!doc) throw new NotFoundError(`Section "${section}" not found`);
    const before = doc.images.length;
    doc.images = doc.images.filter((i) => i.path !== imagePath);
    if (doc.images.length === before) throw new NotFoundError("Image not found in section");
    // Persist first: if the save fails the section must not keep pointing at
    // an asset we already destroyed.
    await doc.save();
    // The admin UI promises "you can re-upload it later" — so hard-delete the
    // Cloudinary asset now rather than leaving it around with no per-image
    // restore endpoint to recover it. The publicId is preserved in the audit
    // log for forensics.
    const deleted = await hardDeleteFile(imagePath, "image");
    if (!deleted) {
      logger.warn("site-content removeImage: asset not found on Cloudinary", {
        section,
        imagePath,
      });
    }
    return toSiteContentDTO(doc);
  }

  async archive(section: string): Promise<SiteContentDTO> {
    const doc = await this.repository.findBySection(section);
    if (!doc) throw new NotFoundError(`Section "${section}" not found`);
    doc.archivedAt = new Date();
    doc.isPublished = false;
    await doc.save();
    return toSiteContentDTO(doc);
  }

  async unarchive(section: string): Promise<SiteContentDTO> {
    const doc = await this.repository.findBySection(section);
    if (!doc) throw new NotFoundError(`Section "${section}" not found`);
    doc.archivedAt = null;
    await doc.save();
    return toSiteContentDTO(doc);
  }

  async hardDelete(section: string): Promise<void> {
    const doc = await this.repository.findBySection(section);
    if (!doc) throw new NotFoundError(`Section "${section}" not found`);
    for (const img of doc.images) await hardDeleteFile(img.path, "image");
    await doc.deleteOne();
  }

  /** Idempotent seed run at boot — ensures defaults exist for every known section. */
  async ensureDefaults(): Promise<void> {
    for (const section of Object.keys(SITE_CONTENT_DEFAULTS)) {
      const existing = await this.repository.findBySection(section);
      if (existing) continue;
      const data = SITE_CONTENT_DEFAULTS[section] ?? {};
      await this.repository.upsertBySection(section, {
        data,
        images: [],
        isPublished: true,
      });
    }
  }
}
