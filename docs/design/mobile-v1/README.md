# MyOrganizer Mobile v1

The approved design for the Mobile App v1 ([PRD #908](https://github.com/mnaimfaizy/myorganizer/issues/908)), committed so that anyone building it — a person, or an agent in a sandbox with no claude.ai login — reads the same design the maintainer approved ([ADR 0110](../../adr/0110-an-approved-design-is-committed-to-the-repo.md)).

|                  |                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Source           | [Claude Design canvas](https://claude.ai/artifact/NQEpyQyfkqKrTEBHmm3ehj) (private; needs the owner's login) |
| Exported version | `1790728996-b9c1`                                                                                            |
| Exported         | 2026-09-30                                                                                                   |
| Built by         | [PR #944](https://github.com/mnaimfaizy/myorganizer/pull/944)                                                |

**These files are the design of record.** When the canvas changes after approval, the change is exported here in its own commit; the canvas link is for collaborating on the next version, and the files here are what an issue or pull request builds to.

## Reading the files

- `artboards/` holds one self-contained HTML file per artboard, as the canvas exported it. Every size, colour, radius and string on an artboard is written inline, so the markup itself answers "what does the design say here". Open a file in a browser to see it: layout and colours render, though the canvas runtime (`support.js`) and web fonts are not included.
- `canvas.json` is the canvas's own index: each artboard's page, title, size and position, and the section headings. The tables below are generated from it.
- The Foundation artboards (colour, type, components, motion, platform notes) apply to every page; a page's artboards show that page's layouts and states, one state per artboard. Where a page artboard and a Foundation artboard disagree, raise it — do not pick one silently.

## Artboards

### 0 · Foundation

**Foundations**

| Artboard     | File                                   | Size        |
| ------------ | -------------------------------------- | ----------- |
| Colour sheet | [Main.dc.html](artboards/Main.dc.html) | 1440 × 4610 |
| Type scale   | [Type.dc.html](artboards/Type.dc.html) | 1440 × 1884 |

**Components**

| Artboard                          | File                                               | Size        |
| --------------------------------- | -------------------------------------------------- | ----------- |
| Components · Screen, header, tabs | [Navigation.dc.html](artboards/Navigation.dc.html) | 1440 × 2346 |
| Components · Lists                | [Lists.dc.html](artboards/Lists.dc.html)           | 1440 × 3870 |
| Components · Controls             | [Controls.dc.html](artboards/Controls.dc.html)     | 1440 × 2782 |
| Components · TextField            | [Inputs.dc.html](artboards/Inputs.dc.html)         | 1440 × 2052 |
| Components · Sheets and feedback  | [Overlays.dc.html](artboards/Overlays.dc.html)     | 1440 × 3584 |

**Motion and platform**

| Artboard       | File                                           | Size        |
| -------------- | ---------------------------------------------- | ----------- |
| Motion notes   | [Motion.dc.html](artboards/Motion.dc.html)     | 1440 × 3124 |
| Platform notes | [Platform.dc.html](artboards/Platform.dc.html) | 1440 × 2300 |

**App icon**

| Artboard | File                                         | Size        |
| -------- | -------------------------------------------- | ----------- |
| App icon | [AppIcon.dc.html](artboards/AppIcon.dc.html) | 1440 × 1780 |

The App icon artboard was drawn in this repository for [#945](https://github.com/mnaimfaizy/myorganizer/issues/945), in the export's format, because the canvas had no app-icon artboard at the exported version. It is not on the canvas and so not in `canvas.json`; the next export should carry it across. It states the icon's construction and every colour; the files both platforms ship are generated from the same shield by `yarn mobile:app-icon:generate`.

### 1 · Entry and unlock

**1 · Login**

| Artboard                  | File                                                                       | Size      |
| ------------------------- | -------------------------------------------------------------------------- | --------- |
| Login                     | [Entry-Login.dc.html](artboards/Entry-Login.dc.html)                       | 390 × 844 |
| Login · signing in        | [Entry-Login-Signing.dc.html](artboards/Entry-Login-Signing.dc.html)       | 390 × 844 |
| Login · wrong credentials | [Entry-Login-Wrong.dc.html](artboards/Entry-Login-Wrong.dc.html)           | 390 × 844 |
| Login · unverified email  | [Entry-Login-Unverified.dc.html](artboards/Entry-Login-Unverified.dc.html) | 390 × 844 |
| Login · disabled account  | [Entry-Login-Disabled.dc.html](artboards/Entry-Login-Disabled.dc.html)     | 390 × 844 |
| Login · offline           | [Entry-Login-Offline.dc.html](artboards/Entry-Login-Offline.dc.html)       | 390 × 844 |

**2 · Forgot password**

| Artboard               | File                                                             | Size      |
| ---------------------- | ---------------------------------------------------------------- | --------- |
| Forgot password        | [Entry-Forgot.dc.html](artboards/Entry-Forgot.dc.html)           | 390 × 844 |
| Forgot password · sent | [Entry-Forgot-Sent.dc.html](artboards/Entry-Forgot-Sent.dc.html) | 390 × 844 |

**3 · No Vault yet**

| Artboard                  | File                                                                       | Size      |
| ------------------------- | -------------------------------------------------------------------------- | --------- |
| No Vault yet              | [Entry-NoVault.dc.html](artboards/Entry-NoVault.dc.html)                   | 390 × 844 |
| No Vault · checking again | [Entry-NoVault-Checking.dc.html](artboards/Entry-NoVault-Checking.dc.html) | 390 × 844 |
| No Vault · still none     | [Entry-NoVault-Still.dc.html](artboards/Entry-NoVault-Still.dc.html)       | 390 × 844 |

**4 · Unlock**

| Artboard                                   | File                                                                             | Size      |
| ------------------------------------------ | -------------------------------------------------------------------------------- | --------- |
| Unlock · passphrase (Biometric Unlock off) | [Entry-Unlock-Passphrase.dc.html](artboards/Entry-Unlock-Passphrase.dc.html)     | 390 × 844 |
| Unlock · Face ID on (iOS)                  | [Entry-Unlock-FaceID.dc.html](artboards/Entry-Unlock-FaceID.dc.html)             | 390 × 844 |
| Unlock · fingerprint on (Android)          | [Entry-Unlock-Fingerprint.dc.html](artboards/Entry-Unlock-Fingerprint.dc.html)   | 390 × 844 |
| Unlock · deriving                          | [Entry-Unlock-Deriving.dc.html](artboards/Entry-Unlock-Deriving.dc.html)         | 390 × 844 |
| Unlock · wrong passphrase                  | [Entry-Unlock-Wrong.dc.html](artboards/Entry-Unlock-Wrong.dc.html)               | 390 × 844 |
| Unlock · offline                           | [Entry-Unlock-Offline.dc.html](artboards/Entry-Unlock-Offline.dc.html)           | 390 × 844 |
| Unlock · Face ID cancelled                 | [Entry-Unlock-BioCancelled.dc.html](artboards/Entry-Unlock-BioCancelled.dc.html) | 390 × 844 |
| Unlock · biometrics changed                | [Entry-Unlock-BioInvalid.dc.html](artboards/Entry-Unlock-BioInvalid.dc.html)     | 390 × 844 |
| Unlock · Face ID on · dark                 | [Entry-Unlock-FaceID-Dark.dc.html](artboards/Entry-Unlock-FaceID-Dark.dc.html)   | 390 × 844 |

**5 · Recovery Key unlock**

| Artboard                 | File                                                                     | Size      |
| ------------------------ | ------------------------------------------------------------------------ | --------- |
| Recovery Key · empty     | [Entry-Recovery.dc.html](artboards/Entry-Recovery.dc.html)               | 390 × 844 |
| Recovery Key · filled    | [Entry-Recovery-Filled.dc.html](artboards/Entry-Recovery-Filled.dc.html) | 390 × 844 |
| Recovery Key · wrong key | [Entry-Recovery-Wrong.dc.html](artboards/Entry-Recovery-Wrong.dc.html)   | 390 × 844 |

**6 · Biometric Unlock offer**

| Artboard                     | File                                                                         | Size      |
| ---------------------------- | ---------------------------------------------------------------------------- | --------- |
| Biometric offer · iOS        | [Entry-Offer-FaceID.dc.html](artboards/Entry-Offer-FaceID.dc.html)           | 390 × 844 |
| Biometric offer · Android    | [Entry-Offer-Fingerprint.dc.html](artboards/Entry-Offer-Fingerprint.dc.html) | 390 × 844 |
| Biometric offer · iOS · dark | [Entry-Offer-FaceID-Dark.dc.html](artboards/Entry-Offer-FaceID-Dark.dc.html) | 390 × 844 |

**7 · Privacy cover**

| Artboard              | File                                                           | Size      |
| --------------------- | -------------------------------------------------------------- | --------- |
| Privacy cover · light | [Entry-Cover.dc.html](artboards/Entry-Cover.dc.html)           | 390 × 844 |
| Privacy cover · dark  | [Entry-Cover-Dark.dc.html](artboards/Entry-Cover-Dark.dc.html) | 390 × 844 |

**8 · Locked**

| Artboard                           | File                                                   | Size        |
| ---------------------------------- | ------------------------------------------------------ | ----------- |
| Locked · from a tab back to Unlock | [Entry-Locked.dc.html](artboards/Entry-Locked.dc.html) | 2206 × 1124 |

### 2 · Groceries

**1 · Tab shell**

| Artboard                       | File                                                         | Size      |
| ------------------------------ | ------------------------------------------------------------ | --------- |
| Shell · Groceries tab selected | [Groc-Shell.dc.html](artboards/Groc-Shell.dc.html)           | 390 × 844 |
| Shell · dark                   | [Groc-Shell-Dark.dc.html](artboards/Groc-Shell-Dark.dc.html) | 390 × 844 |

**2 · Grocery Lists**

| Artboard                 | File                                                                           | Size      |
| ------------------------ | ------------------------------------------------------------------------------ | --------- |
| Lists · press and hold   | [Groc-Lists-Actions.dc.html](artboards/Groc-Lists-Actions.dc.html)             | 390 × 844 |
| Lists · rename           | [Groc-Lists-Rename.dc.html](artboards/Groc-Lists-Rename.dc.html)               | 390 × 844 |
| Lists · create list      | [Groc-Lists-Create.dc.html](artboards/Groc-Lists-Create.dc.html)               | 390 × 844 |
| Lists · swiped to delete | [Groc-Lists-Swipe.dc.html](artboards/Groc-Lists-Swipe.dc.html)                 | 390 × 844 |
| Lists · confirm delete   | [Groc-Lists-ConfirmDelete.dc.html](artboards/Groc-Lists-ConfirmDelete.dc.html) | 390 × 844 |
| Lists · empty            | [Groc-Lists-Empty.dc.html](artboards/Groc-Lists-Empty.dc.html)                 | 390 × 844 |

**3 · Trip view**

| Artboard                                | File                                                                           | Size       |
| --------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| Trip · in the shop                      | [Groc-Trip.dc.html](artboards/Groc-Trip.dc.html)                               | 390 × 844  |
| Trip · dark (poor light)                | [Groc-Trip-Dark.dc.html](artboards/Groc-Trip-Dark.dc.html)                     | 390 × 844  |
| Trip · scrolled, sticky header          | [Groc-Trip-Scrolled.dc.html](artboards/Groc-Trip-Scrolled.dc.html)             | 390 × 844  |
| Trip · full length, Checked collapsed   | [Groc-Trip-Full.dc.html](artboards/Groc-Trip-Full.dc.html)                     | 390 × 1155 |
| Trip · Checked expanded                 | [Groc-Trip-CheckedOpen.dc.html](artboards/Groc-Trip-CheckedOpen.dc.html)       | 390 × 844  |
| Trip · editing an amount                | [Groc-Trip-Amount.dc.html](artboards/Groc-Trip-Amount.dc.html)                 | 390 × 844  |
| Trip · swiped: Delete List Line         | [Groc-Trip-Swipe.dc.html](artboards/Groc-Trip-Swipe.dc.html)                   | 390 × 844  |
| Trip · line deleted, Undo               | [Groc-Trip-Undo.dc.html](artboards/Groc-Trip-Undo.dc.html)                     | 390 × 844  |
| Trip · list actions                     | [Groc-Trip-Menu.dc.html](artboards/Groc-Trip-Menu.dc.html)                     | 390 × 844  |
| Trip · confirm Uncheck All              | [Groc-Trip-ConfirmUncheck.dc.html](artboards/Groc-Trip-ConfirmUncheck.dc.html) | 390 × 844  |
| Trip · confirm Remove Checked From List | [Groc-Trip-ConfirmRemove.dc.html](artboards/Groc-Trip-ConfirmRemove.dc.html)   | 390 × 844  |
| Trip · Unconfirmed Edit                 | [Groc-Trip-Unconfirmed.dc.html](artboards/Groc-Trip-Unconfirmed.dc.html)       | 390 × 844  |
| Trip · reverted with Retry (offline)    | [Groc-Trip-Reverted.dc.html](artboards/Groc-Trip-Reverted.dc.html)             | 390 × 844  |
| Trip · changed on another device        | [Groc-Trip-Conflict.dc.html](artboards/Groc-Trip-Conflict.dc.html)             | 390 × 844  |

**4 · Add to list**

| Artboard                      | File                                                                     | Size      |
| ----------------------------- | ------------------------------------------------------------------------ | --------- |
| Add · type-ahead results      | [Groc-Add-Results.dc.html](artboards/Groc-Add-Results.dc.html)           | 390 × 844 |
| Add · just added              | [Groc-Add-Added.dc.html](artboards/Groc-Add-Added.dc.html)               | 390 × 844 |
| Add · create, pick a category | [Groc-Add-Create.dc.html](artboards/Groc-Add-Create.dc.html)             | 390 × 844 |
| Add · results · dark          | [Groc-Add-Results-Dark.dc.html](artboards/Groc-Add-Results-Dark.dc.html) | 390 × 844 |

**5 · Empty trips**

| Artboard           | File                                                                 | Size      |
| ------------------ | -------------------------------------------------------------------- | --------- |
| Trip · no lines    | [Groc-Trip-EmptyList.dc.html](artboards/Groc-Trip-EmptyList.dc.html) | 390 × 844 |
| Trip · all checked | [Groc-Trip-AllDone.dc.html](artboards/Groc-Trip-AllDone.dc.html)     | 390 × 844 |

### 3 · Tasks

**1 · Task list**

| Artboard                              | File                                                                       | Size      |
| ------------------------------------- | -------------------------------------------------------------------------- | --------- |
| List · All                            | [Task-List.dc.html](artboards/Task-List.dc.html)                           | 390 × 844 |
| List · All · dark                     | [Task-List-Dark.dc.html](artboards/Task-List-Dark.dc.html)                 | 390 × 844 |
| List · Work                           | [Task-List-Work.dc.html](artboards/Task-List-Work.dc.html)                 | 390 × 844 |
| List · ticked done (before it leaves) | [Task-List-Ticked.dc.html](artboards/Task-List-Ticked.dc.html)             | 390 × 844 |
| List · swiped right: Done             | [Task-List-SwipeDone.dc.html](artboards/Task-List-SwipeDone.dc.html)       | 390 × 844 |
| List · swiped left: Archive           | [Task-List-SwipeArchive.dc.html](artboards/Task-List-SwipeArchive.dc.html) | 390 × 844 |
| List · archived, Undo                 | [Task-List-Archived.dc.html](artboards/Task-List-Archived.dc.html)         | 390 × 844 |
| List · Show done (recent first)       | [Task-List-Done.dc.html](artboards/Task-List-Done.dc.html)                 | 390 × 844 |
| List · no Tasks yet                   | [Task-List-Empty.dc.html](artboards/Task-List-Empty.dc.html)               | 390 × 844 |
| List · all clear                      | [Task-List-AllClear.dc.html](artboards/Task-List-AllClear.dc.html)         | 390 × 844 |

**2 · Quick capture**

| Artboard                     | File                                                                       | Size      |
| ---------------------------- | -------------------------------------------------------------------------- | --------- |
| Capture · collapsed          | [Task-Capture-Collapsed.dc.html](artboards/Task-Capture-Collapsed.dc.html) | 390 × 844 |
| Capture · focused            | [Task-Capture-Focused.dc.html](artboards/Task-Capture-Focused.dc.html)     | 390 × 844 |
| Capture · chips chosen       | [Task-Capture-Chips.dc.html](artboards/Task-Capture-Chips.dc.html)         | 390 × 844 |
| Capture · saved, Unconfirmed | [Task-Capture-Saved.dc.html](artboards/Task-Capture-Saved.dc.html)         | 390 × 844 |
| Capture · focused · dark     | [Task-Capture-Dark.dc.html](artboards/Task-Capture-Dark.dc.html)           | 390 × 844 |

**3 · Task detail**

| Artboard                    | File                                                                             | Size       |
| --------------------------- | -------------------------------------------------------------------------------- | ---------- |
| Detail                      | [Task-Detail.dc.html](artboards/Task-Detail.dc.html)                             | 390 × 844  |
| Detail · full length        | [Task-Detail-Full.dc.html](artboards/Task-Detail-Full.dc.html)                   | 390 × 1172 |
| Detail · dark               | [Task-Detail-Dark.dc.html](artboards/Task-Detail-Dark.dc.html)                   | 390 × 844  |
| Detail · Status Unconfirmed | [Task-Detail-Saving.dc.html](artboards/Task-Detail-Saving.dc.html)               | 390 × 844  |
| Detail · Priority reverted  | [Task-Detail-Reverted.dc.html](artboards/Task-Detail-Reverted.dc.html)           | 390 × 844  |
| Detail · due date picker    | [Task-Detail-Date.dc.html](artboards/Task-Detail-Date.dc.html)                   | 390 × 844  |
| Detail · confirm delete     | [Task-Detail-ConfirmDelete.dc.html](artboards/Task-Detail-ConfirmDelete.dc.html) | 390 × 844  |

### 4 · Subscriptions

**1 · Subscriptions list**

| Artboard                            | File                                                               | Size       |
| ----------------------------------- | ------------------------------------------------------------------ | ---------- |
| List · Active                       | [Sub-List.dc.html](artboards/Sub-List.dc.html)                     | 390 × 844  |
| List · Active · dark                | [Sub-List-Dark.dc.html](artboards/Sub-List-Dark.dc.html)           | 390 × 844  |
| List · full length                  | [Sub-List-Full.dc.html](artboards/Sub-List-Full.dc.html)           | 390 × 1125 |
| List · Monthly Equivalent explained | [Sub-List-Explainer.dc.html](artboards/Sub-List-Explainer.dc.html) | 390 × 844  |
| List · Cancelled filter             | [Sub-List-Cancelled.dc.html](artboards/Sub-List-Cancelled.dc.html) | 390 × 844  |
| List · Expired filter, none         | [Sub-List-Expired.dc.html](artboards/Sub-List-Expired.dc.html)     | 390 × 844  |
| List · no Subscriptions yet         | [Sub-List-Empty.dc.html](artboards/Sub-List-Empty.dc.html)         | 390 × 844  |

**2 · Subscription detail**

| Artboard                          | File                                                                   | Size       |
| --------------------------------- | ---------------------------------------------------------------------- | ---------- |
| Detail · Netflix                  | [Sub-Detail.dc.html](artboards/Sub-Detail.dc.html)                     | 390 × 844  |
| Detail · full length              | [Sub-Detail-Full.dc.html](artboards/Sub-Detail-Full.dc.html)           | 390 × 1176 |
| Detail · dark                     | [Sub-Detail-Dark.dc.html](artboards/Sub-Detail-Dark.dc.html)           | 390 × 844  |
| Detail · a cancelled Subscription | [Sub-Detail-Cancelled.dc.html](artboards/Sub-Detail-Cancelled.dc.html) | 390 × 844  |
| Detail · after Save, Unconfirmed  | [Sub-Detail-Saving.dc.html](artboards/Sub-Detail-Saving.dc.html)       | 390 × 844  |

**3 · Edit**

| Artboard                    | File                                                         | Size      |
| --------------------------- | ------------------------------------------------------------ | --------- |
| Edit                        | [Sub-Edit.dc.html](artboards/Sub-Edit.dc.html)               | 390 × 844 |
| Edit · amount error         | [Sub-Edit-Error.dc.html](artboards/Sub-Edit-Error.dc.html)   | 390 × 844 |
| Edit · saving               | [Sub-Edit-Saving.dc.html](artboards/Sub-Edit-Saving.dc.html) | 390 × 844 |
| Edit · Mark cancelled sheet | [Sub-Edit-Cancel.dc.html](artboards/Sub-Edit-Cancel.dc.html) | 390 × 844 |
| Edit · dark                 | [Sub-Edit-Dark.dc.html](artboards/Sub-Edit-Dark.dc.html)     | 390 × 844 |

**4 · New Subscription**

| Artboard              | File                                                           | Size      |
| --------------------- | -------------------------------------------------------------- | --------- |
| New · empty           | [Sub-New.dc.html](artboards/Sub-New.dc.html)                   | 390 × 844 |
| New · filled          | [Sub-New-Filled.dc.html](artboards/Sub-New-Filled.dc.html)     | 390 × 844 |
| New · errors          | [Sub-New-Errors.dc.html](artboards/Sub-New-Errors.dc.html)     | 390 × 844 |
| New · choose currency | [Sub-New-Currency.dc.html](artboards/Sub-New-Currency.dc.html) | 390 × 844 |

### 5 · Details

**1 · Details list**

| Artboard                | File                                                           | Size      |
| ----------------------- | -------------------------------------------------------------- | --------- |
| List · Addresses        | [Det-List.dc.html](artboards/Det-List.dc.html)                 | 390 × 844 |
| List · Addresses · dark | [Det-List-Dark.dc.html](artboards/Det-List-Dark.dc.html)       | 390 × 844 |
| List · Old expanded     | [Det-List-Old.dc.html](artboards/Det-List-Old.dc.html)         | 390 × 844 |
| List · Mobile Numbers   | [Det-List-Mobiles.dc.html](artboards/Det-List-Mobiles.dc.html) | 390 × 844 |
| List · no Addresses yet | [Det-List-Empty.dc.html](artboards/Det-List-Empty.dc.html)     | 390 × 844 |

**2 · Address detail**

| Artboard                     | File                                                                 | Size       |
| ---------------------------- | -------------------------------------------------------------------- | ---------- |
| Address · Home               | [Det-Address.dc.html](artboards/Det-Address.dc.html)                 | 390 × 844  |
| Address · field copied       | [Det-Address-Copied.dc.html](artboards/Det-Address-Copied.dc.html)   | 390 × 844  |
| Address · Copy all           | [Det-Address-CopyAll.dc.html](artboards/Det-Address-CopyAll.dc.html) | 390 × 844  |
| Address · full length        | [Det-Address-Full.dc.html](artboards/Det-Address-Full.dc.html)       | 390 × 1231 |
| Address · legacy single line | [Det-Address-Legacy.dc.html](artboards/Det-Address-Legacy.dc.html)   | 390 × 844  |
| Address · dark               | [Det-Address-Dark.dc.html](artboards/Det-Address-Dark.dc.html)       | 390 × 844  |

**3 · Mobile Number detail**

| Artboard                     | File                                                             | Size      |
| ---------------------------- | ---------------------------------------------------------------- | --------- |
| Mobile · Personal            | [Det-Mobile.dc.html](artboards/Det-Mobile.dc.html)               | 390 × 844 |
| Mobile · number copied       | [Det-Mobile-Copied.dc.html](artboards/Det-Mobile-Copied.dc.html) | 390 × 844 |
| Mobile · legacy single field | [Det-Mobile-Legacy.dc.html](artboards/Det-Mobile-Legacy.dc.html) | 390 × 844 |
| Mobile · dark                | [Det-Mobile-Dark.dc.html](artboards/Det-Mobile-Dark.dc.html)     | 390 × 844 |

**4 · Usage Locations**

| Artboard                              | File                                                               | Size      |
| ------------------------------------- | ------------------------------------------------------------------ | --------- |
| Usage Locations · checklist           | [Det-UL.dc.html](artboards/Det-UL.dc.html)                         | 390 × 844 |
| Usage Locations · full length         | [Det-UL-Full.dc.html](artboards/Det-UL-Full.dc.html)               | 390 × 986 |
| Usage Locations · ticked, Unconfirmed | [Det-UL-Unconfirmed.dc.html](artboards/Det-UL-Unconfirmed.dc.html) | 390 × 844 |
| Usage Locations · reverted with Retry | [Det-UL-Reverted.dc.html](artboards/Det-UL-Reverted.dc.html)       | 390 × 844 |
| Usage Locations · all notified        | [Det-UL-AllDone.dc.html](artboards/Det-UL-AllDone.dc.html)         | 390 × 844 |
| Usage Locations · dark                | [Det-UL-Dark.dc.html](artboards/Det-UL-Dark.dc.html)               | 390 × 844 |

### 6 · Account

**1 · Account**

| Artboard                      | File                                                     | Size       |
| ----------------------------- | -------------------------------------------------------- | ---------- |
| Account · iOS                 | [Acct.dc.html](artboards/Acct.dc.html)                   | 390 × 844  |
| Account · full length         | [Acct-Full.dc.html](artboards/Acct-Full.dc.html)         | 390 × 1287 |
| Account · dark                | [Acct-Dark.dc.html](artboards/Acct-Dark.dc.html)         | 390 × 844  |
| Account · Android             | [Acct-Android.dc.html](artboards/Acct-Android.dc.html)   | 390 × 844  |
| Account · scrolled to Log out | [Acct-Scrolled.dc.html](artboards/Acct-Scrolled.dc.html) | 390 × 844  |

**2 · Security**

| Artboard                                    | File                                                                 | Size      |
| ------------------------------------------- | -------------------------------------------------------------------- | --------- |
| Auto-lock picker                            | [Acct-Autolock.dc.html](artboards/Acct-Autolock.dc.html)             | 390 × 844 |
| Biometric Unlock · turn off                 | [Acct-BioOff-Confirm.dc.html](artboards/Acct-BioOff-Confirm.dc.html) | 390 × 844 |
| Biometric Unlock · off                      | [Acct-BioOff.dc.html](artboards/Acct-BioOff.dc.html)                 | 390 × 844 |
| Biometric Unlock · not set up on the device | [Acct-BioUnavailable.dc.html](artboards/Acct-BioUnavailable.dc.html) | 390 × 844 |
| Lock Vault now · pressed                    | [Acct-LockNow.dc.html](artboards/Acct-LockNow.dc.html)               | 390 × 844 |

**3 · Log out**

| Artboard                 | File                                                           | Size      |
| ------------------------ | -------------------------------------------------------------- | --------- |
| Log out · confirm        | [Acct-Logout.dc.html](artboards/Acct-Logout.dc.html)           | 390 × 844 |
| Log out · confirm · dark | [Acct-Logout-Dark.dc.html](artboards/Acct-Logout-Dark.dc.html) | 390 × 844 |
