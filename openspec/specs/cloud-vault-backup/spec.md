## ADDED Requirements

### Requirement: Manage Google Drive cloud backup connection

The system SHALL let an authenticated user connect and disconnect Google Drive from the vault settings page using only the `https://www.googleapis.com/auth/drive.appdata` scope. The system MUST keep Google provider tokens in browser memory only and MUST NOT persist them on MyOrganizer servers or in persistent browser storage.

#### Scenario: Successful connect

- **WHEN** an authenticated user approves Google Drive access from the vault settings page
- **THEN** the system marks Google Drive connected for the current device, enables cloud backup actions, and limits Drive access to `appDataFolder`

#### Scenario: User denies consent

- **WHEN** the user cancels or denies the Google Drive consent flow
- **THEN** the system remains disconnected and does not enable cloud backup or restore actions

#### Scenario: User disconnects Google Drive

- **WHEN** the user selects Disconnect Google Drive from the vault settings page
- **THEN** the system revokes the Google Drive grant, clears local provider session state for that device, and pauses automatic cloud backups until the user reconnects

### Requirement: Upload encrypted vault backups to Google Drive

The system SHALL create a Google Drive cloud backup by exporting the current vault envelope through the existing client-side export pipeline, uploading it as a single file in `appDataFolder`, and marking it complete only after the upload succeeds.

#### Scenario: Manual backup succeeds

- **WHEN** a connected user selects Back up now and the Google Drive upload completes successfully
- **THEN** the system stores one completed encrypted vault backup file in `appDataFolder`

#### Scenario: Partial upload does not replace the latest completed backup

- **WHEN** a backup upload fails before finalization after at least one completed Google Drive backup already exists
- **THEN** the existing latest completed backup remains the one used for restore and the failed upload is not treated as a completed backup

#### Scenario: Retention limit exceeded

- **WHEN** a newly completed backup would increase the number of completed Google Drive backups above the configured retention limit
- **THEN** the system deletes the oldest completed backup files until only the newest retained backups remain

### Requirement: Run automatic cloud backups only while the app is open

The system SHALL let the user set automatic cloud backup to `off`, `daily`, `weekly`, or `monthly`. The system SHALL evaluate due automatic backups only while the app is open and MUST NOT invoke a server-side backup job for this feature.

#### Scenario: Due automatic backup runs while app is open

- **WHEN** automatic backup is enabled, the chosen interval has elapsed since the latest successful Google Drive backup, and the app is open with Google Drive access available
- **THEN** the system starts a cloud backup without additional user input and updates the cloud-backup state on success

#### Scenario: Interval has not elapsed

- **WHEN** the app checks for an automatic backup before the chosen interval has elapsed
- **THEN** the system does not create a new cloud backup

#### Scenario: Silent reauthorization is unavailable

- **WHEN** a due automatic backup needs Google reauthorization that cannot be completed without user interaction
- **THEN** the system skips the automatic backup attempt, marks the provider as needing reconnect, and does not open an interactive consent prompt on its own

### Requirement: Restore the latest retained cloud backup in the browser

The system SHALL let a user restore the latest completed Google Drive backup by downloading it into the browser and processing it locally through the vault import path.

#### Scenario: Restore succeeds on a fresh device

- **WHEN** a user connects Google Drive on a device that does not yet have the vault restored and selects Restore from cloud
- **THEN** the system downloads the latest completed Google Drive backup into the browser, imports it locally, and leaves the vault ready to be unlocked with the user's existing vault key

#### Scenario: No completed cloud backup exists

- **WHEN** the user selects Restore from cloud and no completed Google Drive backup exists in `appDataFolder`
- **THEN** the system informs the user that no cloud backup is available and does not mutate local vault state
