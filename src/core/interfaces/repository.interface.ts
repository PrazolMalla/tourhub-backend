export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Record<string, unknown>, options?: Record<string, unknown>): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Record<string, unknown>): Promise<T | null>;
  delete(id: string): Promise<T | null>;
  count(filter?: Record<string, unknown>): Promise<number>;
}
