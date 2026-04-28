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
import vaultBackupService, {
  VaultBackupRecordDto,
} from '../services/VaultBackupService';
import {
  VaultBackupBlobType,
  VaultBackupEvent,
  VaultBackupSource,
  VaultBackupStatus,
} from '../services/vaultBackupConstants';
import { UserInterface } from '../types';
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
  private getUserId(req: ExRequest): string {
    const user = req.user as UserInterface;
    return user?.id;
  }

  @Post()
  public async recordBackup(
    @Request() req: ExRequest,
    @Body() body: RecordVaultBackupRequest,
  ): Promise<RecordVaultBackupResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await vaultBackupService.recordEvent(userId, body);
    this.setStatus(result.status);
    return result.body as RecordVaultBackupResponse;
  }

  @Get('/latest')
  public async getLatestBackup(
    @Request() req: ExRequest,
    @Query() status?: VaultBackupStatus,
  ): Promise<GetLatestVaultBackupResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await vaultBackupService.getLatest(userId, status);
    this.setStatus(result.status);
    return result.body as GetLatestVaultBackupResponse;
  }

  @Get()
  public async listBackups(
    @Request() req: ExRequest,
    @Query() cursor?: string,
    @Query() limit?: number,
  ): Promise<ListVaultBackupsResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await vaultBackupService.listHistory(userId, {
      cursor,
      limit,
    });
    this.setStatus(result.status);
    return result.body as ListVaultBackupsResponse;
  }
}

const vaultBackupController = new VaultBackupController();
export default vaultBackupController;
