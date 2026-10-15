// User Deletion on the device: the request, then what it leaves behind.
//
// Pure on purpose, like sessionRefresh.ts: no `react-native`, no keychain, no
// module state. The request and both local steps are handed in, so this
// project's Node-environment Jest suite drives every outcome. AuthContext is
// the wiring.
import { UserDeletionBodyConfirmationEnum } from '@myorganiser/app-api-client';

/** The only confirmation `DELETE /users/me` accepts, typed by the User. */
export const USER_DELETION_CONFIRMATION =
  UserDeletionBodyConfirmationEnum.Delete;

export interface UserDeletionDeps {
  /** `DELETE /users/me`. Rejects the way Axios does; resolves on 204. */
  requestDeletion: (body: {
    password: string;
    confirmation: typeof USER_DELETION_CONFIRMATION;
  }) => Promise<void>;
  /**
   * Wipes the deleted User's local data — the single clear-local-data
   * function (#962). Device Settings are not reachable from it.
   */
  clearLocalData: () => Promise<void>;
  /** Forgets the Session and shows sign-in. Never calls the API. */
  endSession: () => Promise<void>;
}

/**
 * Deletes the signed-in User, then everything of theirs on this device.
 *
 * Nothing local changes until the server has deleted the User: a refused
 * request — a wrong password, a running YouTube sync, a refusal below the
 * Version Floor, no answer — rejects with the request's error and leaves the
 * Session, the Refresh Token and the biometric item as they were.
 *
 * Once it has, the device follows whatever happens: the account is gone, so a
 * local wipe that fails part-way still ends the Session rather than leaving a
 * signed-in shell of a User who no longer exists. No logout request is sent;
 * the server has already ended every Session, and the request would only meet
 * a 401.
 */
export function createUserDeletion(
  deps: UserDeletionDeps,
): (password: string) => Promise<void> {
  return async (password) => {
    await deps.requestDeletion({
      password,
      confirmation: USER_DELETION_CONFIRMATION,
    });
    try {
      await deps.clearLocalData();
    } catch {
      // The User is deleted either way; reporting this as a failure would
      // tell them their account still exists. Logout tolerates it the same way.
    }
    await deps.endSession();
  };
}
