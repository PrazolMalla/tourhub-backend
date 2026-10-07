import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { hardDeleteFile } from "../../core/utils/uploads";
import { SeoRepository } from "./seo.repository";
import type { SeoEntityType, SeoImage, SeoRobots } from "./seo.model";
import { emptySeoDTO, toSeoDTO, type SeoDTO, type UpsertSeoInput } from "./seo.types";

export class SeoService extends BaseService<SeoRepository> {
  /** Public read — never throws; returns a neutral, fully-indexable default when unset. */
  async getPublic(entityType: SeoEntityType, entityId: string): Promise<SeoDTO> {
    const doc = await this.repository.findByEntity(entityType, entityId);
    if (!doc || doc.archivedAt) return emptySeoDTO(entityType, entityId);
    return toSeoDTO(doc);
  }

  /**
   * Bulk read for a whole entity type — used by the frontend sitemap to
   * decide which URLs to drop, without one request per page.
   */
  async listPublicByEntityType(entityType?: SeoEntityType): Promise<SeoDTO[]> {
    const docs = await this.repository.listByEntityType(entityType);
    return docs.filter((d) => !d.archivedAt).map(toSeoDTO);
  }

  /** Admin read — no auto-create (avoids bloating the collection on every page view); returns an empty shape to bind the form to. */
  async getAdmin(entityType: SeoEntityType, entityId: string): Promise<SeoDTO> {
    const doc = await this.repository.findByEntity(entityType, entityId);
    return doc ? toSeoDTO(doc) : emptySeoDTO(entityType, entityId);
  }

  async listAdmin(entityType?: SeoEntityType): Promise<SeoDTO[]> {
    const docs = await this.repository.listByEntityType(entityType);
    return docs.map(toSeoDTO);
  }

  async upsert(
    entityType: SeoEntityType,
    entityId: string,
    input: UpsertSeoInput,
  ): Promise<SeoDTO> {
    const existing = await this.repository.findByEntity(entityType, entityId);
    const update: Record<string, unknown> = {};

    if (input.metaTitle !== undefined) update.metaTitle = input.metaTitle;
    if (input.metaDescription !== undefined) update.metaDescription = input.metaDescription;
    if (input.keywords !== undefined) update.keywords = input.keywords;
    if (input.canonicalUrl !== undefined) update.canonicalUrl = input.canonicalUrl;
    if (input.ogTitle !== undefined) update.ogTitle = input.ogTitle;
    if (input.ogDescription !== undefined) update.ogDescription = input.ogDescription;
    if (input.twitterCard !== undefined) update.twitterCard = input.twitterCard;
    if (input.twitterTitle !== undefined) update.twitterTitle = input.twitterTitle;
    if (input.twitterDescription !== undefined)
      update.twitterDescription = input.twitterDescription;
    if (input.structuredDataEnabled !== undefined)
      update.structuredDataEnabled = input.structuredDataEnabled;
    if (input.openInNewTab !== undefined) update.openInNewTab = input.openInNewTab;
    if (input.robots !== undefined) {
      const base: SeoRobots = existing?.robots ?? {
        index: true,
        follow: true,
        noArchive: false,
        noImageIndex: false,
        noSnippet: false,
      };
      update.robots = { ...base, ...input.robots };
    }
    // Explicit empty-string clears (e.g. metaTitle: "" from the transform below undefined already
    // strips it) — Mongo $set with `undefined` values are dropped by Mongoose automatically.

    const doc = await this.repository.upsertByEntity(entityType, entityId, update);
    return toSeoDTO(doc);
  }

  async setOgImage(entityType: SeoEntityType, entityId: string, image: SeoImage): Promise<SeoDTO> {
    const existing = await this.repository.findByEntity(entityType, entityId);
    if (existing?.ogImage?.path) await hardDeleteFile(existing.ogImage.path);
    const doc = await this.repository.setImage(entityType, entityId, "ogImage", image);
    if (!doc) throw new NotFoundError("SEO record not found");
    return toSeoDTO(doc);
  }

  async removeOgImage(entityType: SeoEntityType, entityId: string): Promise<SeoDTO> {
    const existing = await this.repository.findByEntity(entityType, entityId);
    if (!existing) throw new NotFoundError("SEO record not found");
    if (existing.ogImage?.path) await hardDeleteFile(existing.ogImage.path);
    const doc = await this.repository.setImage(entityType, entityId, "ogImage", null);
    if (!doc) throw new NotFoundError("SEO record not found");
    return toSeoDTO(doc);
  }

  async updateOgImageAlt(
    entityType: SeoEntityType,
    entityId: string,
    alt: string,
  ): Promise<SeoDTO> {
    const doc = await this.repository.updateImageAlt(entityType, entityId, "ogImage", alt);
    if (doc === null) throw new NotFoundError("SEO record not found");
    if (doc === undefined) throw new NotFoundError("No OG image set — upload one first");
    return toSeoDTO(doc);
  }

  async setTwitterImage(
    entityType: SeoEntityType,
    entityId: string,
    image: SeoImage,
  ): Promise<SeoDTO> {
    const existing = await this.repository.findByEntity(entityType, entityId);
    if (existing?.twitterImage?.path) await hardDeleteFile(existing.twitterImage.path);
    const doc = await this.repository.setImage(entityType, entityId, "twitterImage", image);
    if (!doc) throw new NotFoundError("SEO record not found");
    return toSeoDTO(doc);
  }

  async removeTwitterImage(entityType: SeoEntityType, entityId: string): Promise<SeoDTO> {
    const existing = await this.repository.findByEntity(entityType, entityId);
    if (!existing) throw new NotFoundError("SEO record not found");
    if (existing.twitterImage?.path) await hardDeleteFile(existing.twitterImage.path);
    const doc = await this.repository.setImage(entityType, entityId, "twitterImage", null);
    if (!doc) throw new NotFoundError("SEO record not found");
    return toSeoDTO(doc);
  }

  async updateTwitterImageAlt(
    entityType: SeoEntityType,
    entityId: string,
    alt: string,
  ): Promise<SeoDTO> {
    const doc = await this.repository.updateImageAlt(entityType, entityId, "twitterImage", alt);
    if (doc === null) throw new NotFoundError("SEO record not found");
    if (doc === undefined) throw new NotFoundError("No Twitter image set — upload one first");
    return toSeoDTO(doc);
  }

  async delete(entityType: SeoEntityType, entityId: string): Promise<void> {
    const existing = await this.repository.findByEntity(entityType, entityId);
    if (!existing) throw new NotFoundError("SEO record not found");
    if (existing.ogImage?.path) await hardDeleteFile(existing.ogImage.path);
    if (existing.twitterImage?.path) await hardDeleteFile(existing.twitterImage.path);
    await this.repository.deleteByEntity(entityType, entityId);
  }
}
