import type { HydratedDocument } from "mongoose";
import type { VehicleDoc, VehicleFact, VehicleImage, VehicleSpec } from "./vehicle.model";
import { cloudinaryAutoUrl } from "../../core/utils/cloudinary.util";

/** Admin-facing DTO (camelCase). */
export interface Vehicle {
  id: string;
  slug: string;
  name: string;
  tag: string;
  desc: string;
  img?: string;
  specs: VehicleSpec[];
  overview: string[];
  features: string[];
  facts: VehicleFact[];
  gallery: string[];
  images: VehicleImage[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleInput {
  slug?: string;
  name: string;
  tag?: string;
  desc?: string;
  img?: string;
  specs?: VehicleSpec[];
  overview?: string[];
  features?: string[];
  facts?: VehicleFact[];
  gallery?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

/** Public shape consumed by the landing `Vehicle` type (`@/data/vehicles`). */
export interface PublicVehicle {
  slug: string;
  name: string;
  tag: string;
  desc: string;
  img: string;
  specs: VehicleSpec[];
  overview: string[];
  features: string[];
  facts: VehicleFact[];
  gallery: string[];
}

/** Best image URL: primary uploaded (Cloudinary auto-format) else external fallback. */
const primaryImage = (doc: HydratedDocument<VehicleDoc>): string | undefined => {
  if (doc.images?.length) {
    const primary = doc.images.find((i) => i.isPrimary) ?? doc.images[0];
    if (primary) return cloudinaryAutoUrl(primary.path);
  }
  return doc.img;
};

export const toVehicleDTO = (doc: HydratedDocument<VehicleDoc>): Vehicle => {
  const dto: Vehicle = {
    id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    tag: doc.tag ?? "",
    desc: doc.desc ?? "",
    specs: doc.specs ?? [],
    overview: doc.overview ?? [],
    features: doc.features ?? [],
    facts: doc.facts ?? [],
    gallery: doc.gallery ?? [],
    images: doc.images ?? [],
    isActive: doc.isActive,
    isFeatured: doc.isFeatured,
    sortOrder: doc.sortOrder ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  const img = primaryImage(doc);
  if (img !== undefined) dto.img = img;
  if (doc.archivedAt) dto.archivedAt = doc.archivedAt;
  return dto;
};

export const toPublicVehicle = (doc: HydratedDocument<VehicleDoc>): PublicVehicle => {
  const uploaded = (doc.images ?? []).map((i) => cloudinaryAutoUrl(i.path));
  return {
    slug: doc.slug,
    name: doc.name,
    tag: doc.tag ?? "",
    desc: doc.desc ?? "",
    img: primaryImage(doc) ?? "",
    specs: doc.specs ?? [],
    overview: doc.overview ?? [],
    features: doc.features ?? [],
    facts: doc.facts ?? [],
    gallery: uploaded.length ? uploaded : (doc.gallery ?? []),
  };
};
