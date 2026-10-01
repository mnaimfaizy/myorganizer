# Mobile release process

How the Mobile App gets from this repository onto Google Play and the Apple App Store. It is written for someone doing it the first time, and it is the procedure to follow, not a record of a release that happened.

The web and backend path is [CI_CD_AND_RELEASE_PROCESS.md](CI_CD_AND_RELEASE_PROCESS.md). The two are separate on purpose: a **Mobile Release** is versioned on its own and is not a Release (see [`CONTEXT.md`](../../CONTEXT.md) § Release & Deploy). The compatibility rules every Mobile Release must honour are [ADR 0114](../adr/0114-a-mobile-release-ships-in-1-0-what-it-cannot-learn-later.md).

> **Status (2026-09-30):** nothing here has been done yet. No store account exists, and the app is not yet submittable. The work that makes it submittable is tracked in the Mobile Release 1.0 readiness PRD, #956. Store rules change often. Every date and threshold below was checked on 2026-09-30, and the last section lists what to re-check before acting.

## Decisions at a glance

| Decision                | Choice                                                      | Why                                                                                                                  |
| ----------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Publisher               | **Individual** account on both stores                       | No registered company. Your legal name is the seller name. No D-U-N-S number is needed.                              |
| Territory               | **Australia only** for v1                                   | Removes the EU trader (DSA) declaration and the French encryption declaration. Adding countries is a checkbox later. |
| Store name              | **MyOrganiser**                                             | Australian spelling, matching the domain and `app.myorganiser`. Repository rename is #954.                           |
| Identifier              | `app.myorganiser` on both platforms                         | [ADR 0086](../adr/0086-a-public-tree-hides-an-operator-not-a-product.md), #807. **Permanent once uploaded to Play.** |
| Versioning              | Independent `mobile-vX.Y.Z`                                 | A Mobile Release is not live when approved, and old ones stay installed.                                             |
| Where builds happen     | **Your Mac**, with keys outside the repo                    | Nothing to leak in a public repo while learning. CI builds come later.                                               |
| Build targets           | Debug talks to your laptop; release talks to **Production** | Closed testers keep real data. No Staging variant in v1.                                                             |
| Crash reporting         | **None** in v1                                              | Store-provided crash data is enough. A third-party reporter risks carrying vault plaintext off the device.           |
| Over-the-air JS updates | **None**                                                    | Every change goes through store review. It also keeps crypto and key handling out of anything but a reviewed binary. |
| Account deletion        | In-app **User Deletion**, plus a public web page            | Both stores require it.                                                                                              |

## Costs

| Item                    | Cost                                                    |
| ----------------------- | ------------------------------------------------------- |
| Google Play Console     | USD 25, once                                            |
| Apple Developer Program | About AUD 149 a year (confirm on the enrollment screen) |
| Build tooling           | Nothing: Xcode and Android Studio on your Mac           |

## Where secrets live

The repository is public. None of the following ever enters git, an issue, a pull request, or a CI log. Keep each one in the password manager, and keep the files themselves in a signing directory outside the repository (written `<signing-dir>` below).

| Secret                                                 | Used for                              | If it leaks                                                                                             |
| ------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Android upload keystore (`.jks`) and its passwords     | Signing the bundle you upload to Play | Ask Google to reset the upload key. Google holds the real app signing key.                              |
| Apple distribution certificate (`.p12`) and password   | Signing the iOS archive               | Revoke it in the Apple Developer portal and issue a new one.                                            |
| App Store Connect API key (`.p8`), when CI arrives     | Uploading builds without Xcode        | **The dangerous one.** Someone can push builds to your account. Revoke it immediately.                  |
| Google Play service account JSON, when CI arrives      | Uploading bundles without the Console | Delete the key in Google Cloud.                                                                         |
| Reviewer account email, password, and vault passphrase | Store review sign-in                  | Change the password. Keep even the email out of the repo, because a public login name invites guessing. |

`debug.keystore` in `apps/mobile/android/app` is the public React Native debug key and is safe to commit. It must never sign a release.

## Before you start

The app has to be submittable first. That is the readiness PRD, #956, and it covers:

- the React Native upgrade (Android API 36, Xcode 26, 16 KB page alignment);
- the `app.myorganiser` identifiers;
- release signing configuration;
- User Deletion;
- the Version Floor and unknown-field preservation (ADR 0114);
- the Production build target;
- the privacy manifest;
- the icon;
- verifying [ADR 0108](../adr/0108-a-mobile-device-may-hold-the-master-key-behind-a-biometric-gate.md)'s biometric rules on both platforms before the closed test. Closed testers keep real vaults, so this is required, not polish.

Only then does anything below start.

You will need:

- A Mac with the Xcode version Apple currently requires (Xcode 26 or later since 2026-04-28), and Android Studio.
- A **physical Android device**. Google verifies new personal accounts through the Play Console app on a real device.
- An iPhone or iPad for the Apple Developer app, which runs identity verification. It also makes a real test device.
- Mail on `myorganiser.app` for the reviewer account and the store support address.
- A public privacy policy, `https://myorganiser.app/privacy`, that mentions the Mobile App and User Deletion, and a public page explaining how to delete an account.

## Part 1: Accounts

Order matters. Google has the longer clock, and Apple's yearly fee starts on the day you enroll.

### Google Play Console (first)

1. Go to the Play Console sign-up and choose **Personal** (for yourself).
2. Pay the USD 25 fee. Verify your identity with government ID in your **legal name**, the same name on the card.
3. Install the Play Console app on your Android device and complete **device verification**.
4. What is public: your legal name, your country, and the developer email. Your address is shown only if you charge money.
5. **New personal accounts carry a testing gate.** You cannot publish to production until a closed test has had **at least 12 testers opted in for 14 days in a row**. The clock starts only once a reviewed closed-test build is live, so line up your testers early. Friends, family and former colleagues all count.

### Apple Developer Program (when the iOS build archives cleanly)

1. Install the **Apple Developer** app on your iPhone. Enroll as an **Individual** and use the same device throughout.
2. Your legal first and last name becomes the **seller name** on the App Store. Aliases cause delays, and a P.O. box is not accepted as your address.
3. Verify with photo ID in the app, and pay the annual fee. Individual approval is usually immediate. Allow for a delay anyway.
4. The EU Digital Services Act trader question does not apply while the app is distributed only in Australia.

## Part 2: Signing, on your Mac

### Android

1. Generate an **upload key** into `<signing-dir>`. Never generate it inside the repository.

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore <signing-dir>/upload.jks -alias myorganiser-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Store the keystore file and both passwords in the password manager straight away. Without them you cannot update the app, short of asking Google to reset the upload key.
3. Point Gradle at it from your **user-level** Gradle properties file in your home directory, never from `apps/mobile/android/gradle.properties`, which is tracked. **This does not work yet.** Today the release build type in `apps/mobile/android/app/build.gradle` signs with the public debug key, as its own "Caution!" comment says. Making it read these properties, and refuse to build a release without them, is the readiness PRD's signing work (#956), which also fixes the property names.
4. **Play App Signing** is automatic for a new app. You sign uploads with the upload key, and Google signs what users install with a key it holds.

### iOS

1. In Xcode, sign in with your Apple ID and select your team on the `Mobile` target. Automatic signing creates the App ID, the certificates, and the provisioning profiles for whatever bundle identifier the target carries, which is `app.myorganiser` (#807).
2. Export the **Apple Distribution** certificate from Keychain Access as a `.p12`, and store it with its password in the password manager. You need it again on a new Mac, and in CI later.

## Part 3: Versioning a Mobile Release

| Field                                            | Android       | iOS                          | Rule                                                                                  |
| ------------------------------------------------ | ------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| Mobile Release version (what users see, `X.Y.Z`) | `versionName` | `CFBundleShortVersionString` | The same on both platforms. This is what the Version Floor compares.                  |
| Build number                                     | `versionCode` | `CFBundleVersion`            | An integer that only ever goes up and is never reused, not even for a rejected build. |

- The first Mobile Release is `1.0.0`.
- Bump the patch for fixes, the minor for features, and the major when the Version Floor must drop an earlier major.
- Keep the build numbers identical across both platforms, so one number names one build.
- The `mobile-vX.Y.Z` tag is a **receipt**, as a web Tag is. Apply it only after a store has made that version available, never to trigger a build.

## Part 4: Build and check the release

1. Bump the version and build number (Part 3).
2. Build the Android App Bundle from `apps/mobile/android` with `./gradlew bundleRelease`. The output is the `.aab` under the app module's release bundle outputs.
3. In Xcode, select the Release scheme and choose **Product → Archive**.
4. **Test the real release build** on a device against Production before uploading. Use `run-ios --mode Release` or `run-android --mode release`. This is the build testers and reviewers get: precompiled JavaScript, no developer menu, HTTPS only. Sign in with your own Production account and use every tab.
5. Check the release before it leaves your Mac:
   - Android: every native library is 16 KB aligned. Run `zipalign -c -P 16 -v 4` on an APK built from the bundle.
   - iOS: run Xcode's **Privacy Report** on the archive. Anything it lists must also appear in the privacy manifest `apps/mobile/ios/Mobile/PrivacyInfo.xcprivacy` and in the App Privacy answers.
   - No request goes to `localhost`, `10.0.2.2`, or plain `http`.
   - Biometric Unlock follows ADR 0108 on a real device of each platform:
     - It accepts a strong biometric only, never the device PIN, pattern, or passcode.
     - It stops working after a fingerprint or face is added or removed, and falls back to the passphrase and Recovery Key without locking the User out.

## Part 5: Google Play, first release

1. **Create the app**: name MyOrganiser, default language English (Australia), App, Free. The package name comes from the first upload and is **permanent**.
2. **Store listing**:
   - short and full description in Australian English;
   - a 512×512 icon and a 1024×500 feature graphic;
   - phone screenshots;
   - support email on `myorganiser.app`;
   - the privacy policy URL.
3. **App content**. Every item is required:
   - **Privacy policy**: the URL.
   - **Ads**: none.
   - **App access**: login required. Give the reviewer account's email, password, and vault passphrase, with steps to unlock the vault.
   - **Content rating**: the IARC questionnaire (no violence, no user-generated sharing, no gambling).
   - **Target audience**: adults (18+). This keeps the Families policy out of scope.
   - **Data safety**, per the table in Part 7.
   - **Financial features** and **Health**: declare none. Both are mandatory even for an app without them.
   - **Account deletion**: the public deletion page URL, confirming that in-app deletion exists.
4. **Internal testing**: upload the `.aab`, and add yourself. This track is not reviewed, so it is for a smoke test on real devices.
5. **Closed testing**:
   - Create a track, add your 12 or more testers by email list or Google Group, and send them the opt-in link.
   - Set the **track's** countries to include wherever your testers live. Production stays Australia-only.
   - The track is reviewed. **The 14 days count from when 12 testers are opted in to a live build.**
   - New builds can be pushed during the 14 days without resetting it.
6. **Apply for production** from the Dashboard once the 14 days are done. Google asks about the closed test, the app, and your readiness. Review usually takes up to 7 days.
7. **Production release**:
   - Set the countries to **Australia only**.
   - Use a **staged rollout**, for example 20% and then 100%. You raise the percentage by hand.
   - A staged rollout can be halted for an update, but not for the very first release.

## Part 6: Apple App Store, first release

1. **Create the app** in App Store Connect:
   - platform iOS, name MyOrganiser, primary language English (Australia), bundle ID `app.myorganiser`, and an SKU of your choosing.
   - App Store names are unique across the whole store. If MyOrganiser is taken, use `MyOrganiser: <short descriptor>`, within 30 characters.
2. **Pricing and Availability**: Free, and **Australia** only.
3. **App Privacy**: the privacy policy URL, and the questionnaire answered per Part 7.
4. **Age rating**: complete the questionnaire, including the social-media capability questions required since September 2026. A personal organiser answers "none" throughout.
5. **Encryption (export compliance)**:
   - The app uses standard algorithms (AES-GCM, PBKDF2) through `react-native-quick-crypto`, not only Apple's built-in cryptography.
   - Answer the questions once, then add the resulting `ITSAppUsesNonExemptEncryption` value, with the matching compliance code if Apple issues one, to `apps/mobile/ios/Mobile/Info.plist`, so later uploads stop asking.
   - With France excluded, no French declaration is needed.
   - **Before submitting, confirm** in the US BIS encryption guidance whether an annual self-classification report applies, and whether Australia's Defence and Strategic Goods List (Category 5 Part 2) needs anything. Both reportedly have a mass-market exemption. This is the one open legal question in this process.
6. **Upload** the archive from Xcode's Organizer (**Distribute App → App Store Connect**), or with Transporter.
7. **TestFlight**:
   - Internal testers (up to 100 App Store Connect users) get builds without review.
   - External testers (up to 10,000) need **Beta App Review** for the first build. That needs "What to Test", a contact, and the reviewer account.
8. **App Review information**:
   - the reviewer account's email, password, and vault passphrase;
   - a note that sign-up happens on the web;
   - your contact details.
   - Make sure Production is up. "Turn on your back end" is in Apple's own guideline 2.1.
9. **Submit**. Most reviews finish within 24 hours. Rejections for incompleteness (guideline 2.1) are over 40% of all rejections: crashes, placeholder content, a login that does not work.
10. **Release** with **phased release**. Automatic updates reach 1%, 2%, 5%, 10%, 20%, 50%, then 100% over seven days, and can be paused. Anyone can still download it manually.

## Part 7: What the privacy forms say

These answers must match what the app and backend actually do. Re-check them whenever either changes.

| Data                                                                   | Collected?                | Why                        | Notes                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name, email address                                                    | Yes                       | Account, app functionality | Linked to the User. Not used for tracking.                                                                                                                                            |
| User ID                                                                | Yes                       | App functionality          | Linked to the User.                                                                                                                                                                   |
| Vault contents (tasks, groceries, subscriptions, addresses, and so on) | Stored as ciphertext only | App functionality (sync)   | End-to-end encrypted: the server cannot read it. Google's form exempts end-to-end encrypted data from disclosure; declare it on Apple's form as user content, not linked to tracking. |
| Crash logs, diagnostics, analytics                                     | No                        | none                       | No crash reporter in v1. Store-provided crash data is collected by the store, not by the app.                                                                                         |
| Location, contacts, photos                                             | No                        | none                       | The iOS location usage string is stale. It is still present, and removing it is readiness PRD work (#956).                                                                            |

- All data is encrypted in transit (HTTPS).
- Users can delete their data through User Deletion.

## Part 8: The reviewer account

- A dedicated User in **Production**, on a `myorganiser.app` address. It is never your personal account.
- Verified email, and a vault with a few realistic records in every tab, so no screen is empty.
- **Permanent.** Every future Mobile Release is reviewed with it. Never disable it, and never use it to test User Deletion.
- Google's pre-launch robots sign in and tap everything, deletes included. Keep an **Escape Copy** of the seeded vault in the password manager, and re-import it when the data gets churned.
- Reviewers are usually outside Australia. The territory limit is on the store, not the API, so nothing on the backend may block by region.

## Part 9: After a Mobile Release

1. Apply the `mobile-vX.Y.Z` tag once a store has made the version available.
2. Watch Android vitals in the Play Console, and crash reports in Xcode's Organizer.
3. **There is no rollback.** A bad build is replaced by a new build with a higher build number. Meanwhile, halt the Play staged rollout or pause Apple's phased release.
4. **Raising the Version Floor** is a backend configuration change per environment. Raise it only after the version it points to is available on both stores, or the Users you refuse will have nothing to update to.

## Deferred, and why

| Deferred                                            | Why                                                                                                                                                                                       | Revisit when                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| CI builds on GitHub Actions                         | Learn signing by hand first. Later: a protected `mobile-release` environment with a required reviewer, running only on release refs and never on `pull_request` or `pull_request_target`. | Both apps are live, and a build by hand becomes a chore.           |
| A Staging build variant (`app.myorganiser.staging`) | A second App ID, store entry, and signing set for no v1 benefit.                                                                                                                          | You want to test a release build against Staging before promoting. |
| Crash reporter                                      | A reporter can capture plaintext in breadcrumbs and errors. It needs a designed, tested scrubber.                                                                                         | Users report crashes the store data cannot explain.                |
| Over-the-air JS updates                             | They bypass review for code that handles keys and crypto.                                                                                                                                 | Not planned.                                                       |
| A soft "update available" prompt, or in-app updates | Only the hard Version Floor has to ship in 1.0 (ADR 0114).                                                                                                                                | Any later Mobile Release.                                          |
| Countries beyond Australia                          | Budget and scope. The EU brings the trader declaration; France brings the encryption declaration.                                                                                         | You want a wider audience.                                         |

## Re-check before acting

Checked on 2026-09-30. Confirm each one on the store's own pages when you get to it:

- Google Play's target API level. It has been API 36 for new apps and updates since 2026-08-31, and it rises every year.
- The 16 KB page size deadline. Google's sources disagree (2025-11-01, 2026-05-31, and 2027-02-01 have all been published). Build aligned regardless.
- The Xcode and SDK Apple requires for uploads. The iOS 27 SDK is expected to become the minimum from April 2027.
- The 12-tester, 14-day rule for new personal Play accounts.
- The Apple fee in Australian dollars, and how long enrollment really takes.
- The BIS and Defence and Strategic Goods List positions on annual reporting, for an app encrypting its own users' data with standard algorithms.
