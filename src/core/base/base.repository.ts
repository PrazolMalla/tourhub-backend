import type { HydratedDocument, Model, SortOrder } from "mongoose";

/**
 * Mongoose 9 stopped publicly exporting `FilterQuery`/`UpdateQuery`/`QueryOptions`,
 * and `Parameters<Model<T>["find"]>` resolves to the chainable `Query` overload
 * (not the filter variant). We accept a structurally-loose `Filter` at the API
 * boundary and use Mongoose's chainable Query API to preserve hydrated return types.
 */
export type Filter = Record<string, unknown>;
export interface FindOptions {
  skip?: number;
  limit?: number;
  sort?: Record<string, SortOrder>;
}

export abstract class BaseRepository<TDoc> {
  constructor(protected readonly model: Model<TDoc>) {}

  async findById(id: string): Promise<HydratedDocument<TDoc> | null> {
    return this.model.findById(id);
  }

  async findOne(filter: Filter): Promise<HydratedDocument<TDoc> | null> {
    // reason: Mongoose's internal QueryFilter<T> is not publicly exported; runtime accepts plain objects.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.model.findOne(filter as any);
  }

  async findAll(filter: Filter = {}, options: FindOptions = {}): Promise<HydratedDocument<TDoc>[]> {
    // reason: same as findOne — typed filter widening for unexposed Mongoose types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = this.model.find(filter as any);
    if (options.skip !== undefined) query = query.skip(options.skip);
    if (options.limit !== undefined) query = query.limit(options.limit);
    if (options.sort !== undefined) query = query.sort(options.sort);
    return query.exec();
  }

  async create(data: Partial<TDoc>): Promise<HydratedDocument<TDoc>> {
    return this.model.create(data);
  }

  async update(id: string, data: object): Promise<HydratedDocument<TDoc> | null> {
    // reason: UpdateQuery<T> internals not exported; mongoose accepts plain partial objects at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.model.findByIdAndUpdate(id, data as any, { new: true });
  }

  async delete(id: string): Promise<HydratedDocument<TDoc> | null> {
    return this.model.findByIdAndDelete(id);
  }

  async count(filter: Filter = {}): Promise<number> {
    // reason: same as findOne — typed filter widening for unexposed Mongoose types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.model.countDocuments(filter as any);
  }
}
