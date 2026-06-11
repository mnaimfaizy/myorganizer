import { VaultApi, Configuration } from '@myorganizer/app-api-client';
import type { AxiosInstance } from 'axios';

const BASE_PATH = 'http://localhost:3000/api/v1';

/**
 * Builds the generated Vault API client bound to an already-configured Axios
 * instance — typically the auth module's `apiClient`, whose interceptors attach
 * the bearer token and handle 401 → refresh. Keeping the instance external means
 * this lib stays decoupled from the auth module.
 */
export function createVaultApi(apiClient: AxiosInstance): VaultApi {
  return new VaultApi(
    new Configuration({ basePath: BASE_PATH }),
    BASE_PATH,
    apiClient,
  );
}
