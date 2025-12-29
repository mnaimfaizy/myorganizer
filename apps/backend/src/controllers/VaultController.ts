import { Request as ExRequest } from 'express';
import {
  Body,
  Controller,
  Get,
  Header,
  Middlewares,
  Path,
  Post,
  Put,
  Request,
  Route,
  Security,
  Tags,
} from 'tsoa';
import vaultService, {
  EncryptedBlobV1,
  VaultBlobType,
  VaultExportV1,
  VaultMetaV1,
} from '../services/VaultService';
import { UserInterface } from '../types';
import passport from '../utils/passport';

type ErrorResponse = { message: string; details?: unknown };

type GetVaultMetaResponse =
  | { meta: VaultMetaV1; updatedAt: string; etag: string }
  | ErrorResponse;

type PutVaultMetaResponse =
  | { ok: true; etag: string; updatedAt: string }
  | ErrorResponse;

type GetVaultBlobResponse =
  | {
      type: VaultBlobType;
      blob: EncryptedBlobV1;
      updatedAt: string;
      etag: string;
    }
  | ErrorResponse;

type PutVaultBlobResponse =
  | { ok: true; etag: string; updatedAt: string }
  | ErrorResponse;

type ExportVaultResponse = VaultExportV1 | ErrorResponse;

type ImportVaultResponse = { ok: true } | ErrorResponse;

@Tags('Vault')
@Route('/vault')
@Security('jwt')
@Middlewares([passport.authenticate('jwt', { session: false })])
export class VaultController extends Controller {
  private getUserId(req: ExRequest): string {
    const user = req.user as UserInterface;
    return user?.id;
  }

  @Get()
  public async getVaultMeta(
    @Request() req: ExRequest
  ): Promise<GetVaultMetaResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await vaultService.getVaultMeta(userId);
    this.setStatus(result.status);
    return result.body as GetVaultMetaResponse;
  }

  @Put()
  public async putVaultMeta(
    @Request() req: ExRequest,
    @Body() requestBody: { meta: VaultMetaV1 },
    @Header('if-match') ifMatch?: string
  ): Promise<PutVaultMetaResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await vaultService.putVaultMeta(
      userId,
      requestBody?.meta,
      ifMatch
    );
    this.setStatus(result.status);
    return result.body as PutVaultMetaResponse;
  }

  @Get('/blob/{type}')
  public async getVaultBlob(
    @Request() req: ExRequest,
    @Path() type: VaultBlobType
  ): Promise<GetVaultBlobResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await vaultService.getBlob(userId, type);
    this.setStatus(result.status);
    return result.body as GetVaultBlobResponse;
  }

  @Put('/blob/{type}')
  public async putVaultBlob(
    @Request() req: ExRequest,
    @Path() type: VaultBlobType,
    @Body() requestBody: { type: VaultBlobType; blob: EncryptedBlobV1 },
    @Header('if-match') ifMatch?: string
  ): Promise<PutVaultBlobResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    if (requestBody?.type && requestBody.type !== type) {
      this.setStatus(422);
      return { message: 'Body type must match path type' };
    }

    const result = await vaultService.putBlob(
      userId,
      type,
      requestBody?.blob,
      ifMatch
    );
    this.setStatus(result.status);
    return result.body as PutVaultBlobResponse;
  }

  @Post('/export')
  public async exportVault(
    @Request() req: ExRequest
  ): Promise<ExportVaultResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await vaultService.exportVault(userId);
    this.setStatus(result.status);
    return result.body as ExportVaultResponse;
  }

  @Post('/import')
  public async importVault(
    @Request() req: ExRequest,
    @Body() requestBody: VaultExportV1
  ): Promise<ImportVaultResponse> {
    const userId = this.getUserId(req);
    if (!userId) {
      this.setStatus(401);
      return { message: 'Unauthorized' };
    }

    const result = await vaultService.importVault(userId, requestBody);
    this.setStatus(result.status);
    return result.body as ImportVaultResponse;
  }
}

const vaultController = new VaultController();
export default vaultController;
