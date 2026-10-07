import type { HydratedDocument } from "mongoose";
import { TeamMemberDoc } from "./team-member.model";

export interface TeamMember {
  id: string;
  profilePhoto?: string;
  name: string;
  role: string;
  location: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTeamMemberInput {
  profilePhoto?: string;
  name: string;
  role: string;
  location: string;
  description: string;
}

export interface UpdateTeamMemberInput {
  profilePhoto?: string;
  name?: string;
  role?: string;
  location?: string;
  description?: string;
}

export const toTeamMemberDTO = (doc: HydratedDocument<TeamMemberDoc>): TeamMember => {
  const dto: TeamMember = {
    id: doc._id.toString(),
    name: doc.name,
    role: doc.role,
    location: doc.location,
    description: doc.description,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  if (doc.profilePhoto !== undefined) {
    dto.profilePhoto = doc.profilePhoto;
  }

  return dto;
};
