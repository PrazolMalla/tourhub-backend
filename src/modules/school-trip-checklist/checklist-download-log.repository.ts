import { BaseRepository } from "../../core/base/base.repository";
import {
  ChecklistDownloadLogModel,
  type ChecklistDownloadLogDoc,
} from "./checklist-download-log.model";

export class ChecklistDownloadLogRepository extends BaseRepository<ChecklistDownloadLogDoc> {
  constructor() {
    super(ChecklistDownloadLogModel);
  }
}
