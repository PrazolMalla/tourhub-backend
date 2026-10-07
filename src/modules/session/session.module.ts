import { SessionRepository } from "./session.repository";
import { SessionService } from "./session.service";

export class SessionModule {
  private static _service: SessionService | null = null;

  static service(): SessionService {
    if (!this._service) {
      this._service = new SessionService(new SessionRepository());
    }
    return this._service;
  }
}
