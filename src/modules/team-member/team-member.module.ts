import type { Router } from "express";
import { TeamMemberController } from "./team-member.controller";
import { TeamMemberRepository } from "./team-member.repository";
import { TeamMemberRoutes } from "./team-member.routes";
import { TeamMemberService } from "./team-member.service";

export class TeamMemberModule {
  private static _service: TeamMemberService | null = null;

  static service(): TeamMemberService {
    if (!this._service) {
      this._service = new TeamMemberService(new TeamMemberRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new TeamMemberController(this.service());
    return new TeamMemberRoutes(controller).getRouter();
  }
}

export default TeamMemberModule.create();
