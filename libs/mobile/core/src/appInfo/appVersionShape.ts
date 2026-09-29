/**
 * The app's version and build. Its own module so both platform variants of
 * ./appVersion can import it: in the web program `./appVersion` resolves to
 * the `.web` file itself.
 */
export interface AppVersion {
  /** "1.0" — MARKETING_VERSION / versionName. */
  version: string;
  /** "1" — CURRENT_PROJECT_VERSION / versionCode. */
  build: string;
}
