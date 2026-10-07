import { BaseService } from "../../core/base/base.service";
import { NotFoundError } from "../../core/errors";
import { PaginationBuilder } from "../../core/utils/pagination.builder";
import { escapeRegex } from "../../core/utils/regex.util";
import type { PaginatedResult, PaginationOptions } from "../../core/types/pagination.types";
import { SessionModule } from "../session/session.module";
import type { UserRepository } from "./user.repository";
import { toUserDTO, type UpdateUserInput, type User } from "./user.types";

export class UserService extends BaseService<UserRepository> {
  async list(options: PaginationOptions): Promise<PaginatedResult<User>> {
    const filter: Record<string, unknown> = {};
    if (options.search) {
      const safe = escapeRegex(options.search);
      filter.$or = [
        { email: { $regex: safe, $options: "i" } },
        { name: { $regex: safe, $options: "i" } },
      ];
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

    return PaginationBuilder.build(docs.map(toUserDTO), total, options);
  }

  async findById(id: string): Promise<User> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`User ${id} not found`);
    return toUserDTO(doc);
  }

  async getCurrentUser(userId: string): Promise<User> {
    return this.findById(userId);
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    const doc = await this.repository.update(id, data);
    if (!doc) throw new NotFoundError(`User ${id} not found`);
    return toUserDTO(doc);
  }

  async delete(id: string): Promise<void> {
    const doc = await this.repository.delete(id);
    if (!doc) throw new NotFoundError(`User ${id} not found`);
    // Mirror admin deletion: a deleted account must not keep live sessions.
    await SessionModule.service().revokeAllForUser(id, "user", "account-deleted");
  }

  /**
   * Admin-initiated: block or unblock a customer. Blocking revokes all active
   * sessions so the customer is logged out immediately and can't sign back in
   * until an admin clears the block.
   */
  async setBanned(
    id: string,
    isBanned: boolean,
    reason: string | undefined,
    bannedBy: string,
  ): Promise<User> {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`User ${id} not found`);
    await this.repository.setBanned(id, isBanned, reason, bannedBy);
    if (isBanned) {
      await SessionModule.service().revokeAllForUser(id, "user", "customer-banned");
    }
    const updated = await this.repository.findById(id);
    if (!updated) throw new NotFoundError(`User ${id} not found`);
    return toUserDTO(updated);
  }
}
