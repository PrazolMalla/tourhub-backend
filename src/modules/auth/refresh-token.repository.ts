import { BaseRepository } from "../../core/base/base.repository";
import {
  RefreshTokenModel,
  type RefreshTokenDoc,
  type RefreshTokenDocument,
  type RefreshTokenUserKind,
} from "./refresh-token.model";

export class RefreshTokenRepository extends BaseRepository<RefreshTokenDoc> {
  constructor() {
    super(RefreshTokenModel);
  }

  async findByHash(hash: string): Promise<RefreshTokenDocument | null> {
    return this.model.findOne({ tokenHash: hash });
  }

  async revoke(hash: string, replacedByHash?: string): Promise<void> {
    const update: { revokedAt: Date; replacedByHash?: string } = { revokedAt: new Date() };
    if (replacedByHash !== undefined) update.replacedByHash = replacedByHash;
    await this.model.updateOne({ tokenHash: hash }, update);
  }

  async revokeAllForUser(userId: string, userKind: RefreshTokenUserKind): Promise<void> {
    await this.model.updateMany(
      { userId, userKind, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    );
  }
}
