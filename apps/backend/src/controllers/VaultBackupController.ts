import { Request as ExRequest } from 'express';
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from 'tsoa';
import { requireUserId } from '../guards/AuthGuard';
import vaultBackupService, {
  VaultBackupRecordDto,
} from '../services/VaultBackupService';
import {
  VaultBackupBlobType,
  VaultBackupEvent,
  VaultBackupSource,
  VaultBackupStatus,
} from '../services/vaultBackupConstants';
import { ErrorResponse } from './ErrorResponse';

export interface RecordVaultBackupRequest {
  event: VaultBackupEvent;
  source: VaultBackupSource;
  status: VaultBackupStatus;
  errorCode?: string | null;
  schemaVersion: number;
  blobTypes: VaultBackupBlobType[];
  sizeBytes: number;
}

type RecordVaultBackupResponse = VaultBackupRecordDto | ErrorResponse;

type GetLatestVaultBackupResponse = VaultBackupRecordDto | ErrorResponse;

interface VaultBackupHistoryPage {
  items: VaultBackupRecordDto[];
  nextCursor: string | null;
}

type ListVaultBackupsResponse = VaultBackupHistoryPage | ErrorResponse;

@Tags('VaultBackups')
@Route('/vault/backups')
@Security('jwt')
export class VaultBackupController extends Controller {
  @Post()
  public async recordBackup(
    @Request() req: ExRequest,
    @Body() body: RecordVaultBackupRequest,
  ): Promise<RecordVaultBackupResponse> {
    const userId = requireUserId(req);

    const result = await vaultBackupService.recordEvent(userId, body);
    this.setStatus(result.status);
    return result.body as RecordVaultBackupResponse;
  }

  @Get('/latest')
  public async getLatestBackup(
    @Request() req: ExRequest,
    @Query() status?: VaultBackupStatus,
    @Query() source?: VaultBackupSource,
  ): Promise<GetLatestVaultBackupResponse> {
    const userId = requireUserId(req);

    const result = await vaultBackupService.getLatest(userId, status, source);
    this.setStatus(result.status);
    return result.body as GetLatestVaultBackupResponse;
  }

  @Get()
  public async listBackups(
    @Request() req: ExRequest,
    @Query() cursor?: string,
    @Query() limit?: number,
    @Query() source?: VaultBackupSource,
  ): Promise<ListVaultBackupsResponse> {
    const userId = requireUserId(req);

    const result = await vaultBackupService.listHistory(userId, {
      cursor,
      limit,
      source,
    });
    this.setStatus(result.status);
    return result.body as ListVaultBackupsResponse;
  }
}

const vaultBackupController = new VaultBackupController();
export default vaultBackupController;
