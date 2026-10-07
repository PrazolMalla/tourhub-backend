import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";

import { TeamMemberRepository } from "./team-member.repository";
import {
  CreateTeamMemberInput,
  TeamMember,
  toTeamMemberDTO,
  UpdateTeamMemberInput,
} from "./team-member.types";
import { fileToRecord, hardDeleteFile } from "@core/utils/uploads";

export interface TeamMemberListFilters {
  state?: "live" | "trash" | "all";
}

export class TeamMemberService extends BaseService<TeamMemberRepository> {
  async uploadImage(id: string, file: Express.Multer.File) {
    const image = fileToRecord("team-member", file);
    const member = await this.repository.findById(id);

    if (!member) {
      await hardDeleteFile(image.publicId, "image");
      throw new NotFoundError("Team member not found");
    }

    // Replacing the photo — delete the previous asset so it doesn't leak.
    if (member.profilePhotoPublicId) {
      await hardDeleteFile(member.profilePhotoPublicId, "image");
    }

    member.profilePhoto = image.url;
    member.profilePhotoPublicId = image.publicId;

    await member.save();

    return toTeamMemberDTO(member);
  }
  async removeImage(id: string): Promise<TeamMember> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`Team Member Profile ${id} not found`);

    if (doc.profilePhotoPublicId) {
      await hardDeleteFile(doc.profilePhotoPublicId, "image");
    }
    doc.profilePhoto = undefined as unknown as string;
    doc.profilePhotoPublicId = undefined as unknown as string;

    await doc.save();
    return toTeamMemberDTO(doc);
  }
  async create(input: CreateTeamMemberInput): Promise<TeamMember> {
    const payload: CreateTeamMemberInput = {
      name: input.name.trim(),
      role: input.role.trim(),
      location: input.location,
      description: input.description.trim(),
    };
    if (input.profilePhoto !== undefined) {
      payload.profilePhoto = input.profilePhoto;
    }

    const doc = await this.repository.create(payload);

    return toTeamMemberDTO(doc);
  }

  async list(
    options: PaginationOptions,
    filters: TeamMemberListFilters = {},
  ): Promise<PaginatedResult<TeamMember>> {
    const filter: Record<string, unknown> = {};

    const state = filters.state ?? "live";

    if (state === "live") {
      filter.deletedAt = null;
    } else if (state === "trash") {
      filter.deletedAt = { $ne: null };
    }

    if (options.search) {
      const rx = {
        $regex: escapeRegex(options.search),
        $options: "i",
      };

      filter.$or = [{ name: rx }, { role: rx }, { location: rx }, { description: rx }];
    }

    const sort: Record<string, 1 | -1> = {
      [options.sortBy]: options.sortOrder === "asc" ? 1 : -1,
    };

    const [docs, total] = await Promise.all([
      this.repository.findAll(filter, {
        skip: options.skip,
        limit: options.limit,
        sort,
      }),
      this.repository.count(filter),
    ]);

    return PaginationBuilder.build(docs.map(toTeamMemberDTO), total, options);
  }

  async findById(id: string): Promise<TeamMember> {
    const doc = await this.repository.findById(id);

    if (!doc) {
      throw new NotFoundError(`Team member ${id} not found`);
    }

    return toTeamMemberDTO(doc);
  }

  async update(id: string, input: UpdateTeamMemberInput): Promise<TeamMember> {
    const next: Record<string, unknown> = {};

    if (input.profilePhoto !== undefined) {
      next.profilePhoto = input.profilePhoto;
      // Direct edit (bypassing the upload endpoint) while a Cloudinary-
      // uploaded photo is still on record — that asset is about to become
      // unreferenced, so delete it and clear the bookkeeping.
      const existing = await this.repository.findById(id);
      if (
        existing &&
        input.profilePhoto !== existing.profilePhoto &&
        existing.profilePhotoPublicId
      ) {
        await hardDeleteFile(existing.profilePhotoPublicId, "image");
        next.profilePhotoPublicId = null;
      }
    }

    if (input.name !== undefined) {
      next.name = input.name.trim();
    }

    if (input.role !== undefined) {
      next.role = input.role.trim();
    }

    if (input.location !== undefined) {
      next.location = input.location.trim();
    }

    if (input.description !== undefined) {
      next.description = input.description.trim();
    }

    const doc = await this.repository.update(id, next);

    if (!doc) {
      throw new NotFoundError(`Team member ${id} not found`);
    }

    return toTeamMemberDTO(doc);
  }

  async sendToTrash(id: string): Promise<TeamMember> {
    const doc = await this.repository.findById(id);

    if (!doc) {
      throw new NotFoundError(`Team member ${id} not found`);
    }

    doc.deletedAt = new Date();

    await doc.save();

    return toTeamMemberDTO(doc);
  }

  async restoreFromTrash(id: string): Promise<TeamMember> {
    const doc = await this.repository.findById(id);

    if (!doc) {
      throw new NotFoundError(`Team member ${id} not found`);
    }

    doc.deletedAt = null;

    await doc.save();

    return toTeamMemberDTO(doc);
  }

  async hardDelete(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (existing?.profilePhotoPublicId) {
      await hardDeleteFile(existing.profilePhotoPublicId, "image");
    }
    const doc = await this.repository.delete(id);

    if (!doc) {
      throw new NotFoundError(`Team member ${id} not found`);
    }
  }
}
