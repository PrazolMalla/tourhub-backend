import { BaseRepository } from "../../core/base/base.repository";
import { TeamMemberDoc, TeamMemberModel } from "./team-member.model";

export class TeamMemberRepository extends BaseRepository<TeamMemberDoc> {
  constructor() {
    super(TeamMemberModel);
  }
}
