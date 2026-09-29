package com.mobile.biometrickeystore

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The Android half of Biometric Unlock's keystore (ADR 0108 decision 1).
 *
 * `react-native-keychain` generates its Android Keystore key with a five-second
 * validity window and `AUTH_BIOMETRIC_STRONG or AUTH_DEVICE_CREDENTIAL`, and
 * never calls `setInvalidatedByBiometricEnrollment`. Android only invalidates a
 * key on an enrolment change when it needs a strong biometric for **every**
 * use, so on that configuration a fingerprint enrolled later still opened the
 * Vault, and a device PIN did too. This module owns the key spec instead:
 *
 * - one AES-256-GCM key per User, `setUserAuthenticationRequired(true)` with a
 *   zero validity window and `AUTH_BIOMETRIC_STRONG` only, so each encrypt and
 *   decrypt is authorised by one `BiometricPrompt` carrying the cipher as its
 *   `CryptoObject`;
 * - `setInvalidatedByBiometricEnrollment(true)`, so adding or removing a
 *   biometric destroys the key and the next read reports `E_INVALIDATED`.
 *
 * Only the ciphertext and its IV are written to app-private SharedPreferences;
 * the key never leaves the Keystore. `write` raises the prompt too — that is
 * the biometric check the Account tab's "turn on" asks for after the
 * passphrase.
 */
class RNBiometricKeystoreModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "RNBiometricKeystore"

  private val prefs: SharedPreferences
    get() = reactApplicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  @ReactMethod
  fun isSupported(promise: Promise) {
    val answer = BiometricManager.from(reactApplicationContext).canAuthenticate(BIOMETRIC_STRONG)
    promise.resolve(answer == BiometricManager.BIOMETRIC_SUCCESS)
  }

  /** How the prompt is named in copy: "fingerprint" where the device has one. */
  @ReactMethod
  fun method(promise: Promise) {
    val hasFingerprint =
        reactApplicationContext.packageManager.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)
    promise.resolve(if (hasFingerprint) "fingerprint" else "biometrics")
  }

  @ReactMethod
  fun has(userId: String, promise: Promise) {
    try {
      promise.resolve(prefs.contains(entryKey(userId)) && keyStore().containsAlias(alias(userId)))
    } catch (error: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun write(userId: String, value: String, title: String, cancel: String, promise: Promise) {
    val cipher: Cipher
    try {
      deleteEntry(userId)
      cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.ENCRYPT_MODE, generateKey(alias(userId)))
    } catch (error: Exception) {
      deleteEntry(userId)
      promise.reject(E_FAILED, error.message, error)
      return
    }
    authenticate(cipher, title, cancel, promise, onFailure = { deleteEntry(userId) }) { authorised ->
      val ciphertext = authorised.doFinal(value.toByteArray(Charsets.UTF_8))
      prefs.edit().putString(entryKey(userId), encode(authorised.iv) + SEPARATOR + encode(ciphertext)).apply()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun read(userId: String, title: String, cancel: String, promise: Promise) {
    val stored = prefs.getString(entryKey(userId), null)
    val parts = stored?.split(SEPARATOR)
    val key = try {
      keyStore().getKey(alias(userId), null) as SecretKey?
    } catch (error: Exception) {
      null
    }
    if (parts == null || parts.size != 2 || key == null) {
      promise.reject(E_MISSING, "Nothing is stored for this User.")
      return
    }

    val cipher = Cipher.getInstance(TRANSFORMATION)
    try {
      cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, decode(parts[0])))
    } catch (error: KeyPermanentlyInvalidatedException) {
      promise.reject(E_INVALIDATED, error.message, error)
      return
    } catch (error: Exception) {
      promise.reject(E_FAILED, error.message, error)
      return
    }
    authenticate(cipher, title, cancel, promise, onFailure = {}) { authorised ->
      promise.resolve(String(authorised.doFinal(decode(parts[1])), Charsets.UTF_8))
    }
  }

  @ReactMethod
  fun remove(userId: String, promise: Promise) {
    deleteEntry(userId)
    promise.resolve(null)
  }

  /**
   * Raise one `BiometricPrompt` for [cipher] and hand the authorised cipher to
   * [onSuccess]. Every way it ends settles [promise] exactly once; a
   * non-matching finger keeps the prompt up and settles nothing.
   */
  private fun authenticate(
      cipher: Cipher,
      title: String,
      cancel: String,
      promise: Promise,
      onFailure: () -> Unit,
      onSuccess: (Cipher) -> Unit,
  ) {
    val activity = reactApplicationContext.currentActivity as? FragmentActivity
    if (activity == null) {
      onFailure()
      promise.reject(E_FAILED, "No foreground activity to show the prompt on.")
      return
    }
    activity.runOnUiThread {
      val callback =
          object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              val authorised = result.cryptoObject?.cipher
              if (authorised == null) {
                onFailure()
                promise.reject(E_FAILED, "The prompt returned no cipher.")
                return
              }
              try {
                onSuccess(authorised)
              } catch (error: Exception) {
                onFailure()
                promise.reject(E_FAILED, error.message, error)
              }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              onFailure()
              val cancelled =
                  errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                      errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                      errorCode == BiometricPrompt.ERROR_CANCELED
              promise.reject(if (cancelled) E_CANCELLED else E_FAILED, errString.toString())
            }
          }
      val info =
          BiometricPrompt.PromptInfo.Builder()
              .setTitle(title)
              .setNegativeButtonText(cancel)
              .setAllowedAuthenticators(BIOMETRIC_STRONG)
              .build()
      BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback)
          .authenticate(info, BiometricPrompt.CryptoObject(cipher))
    }
  }

  private fun generateKey(alias: String): SecretKey {
    val builder =
        KeyGenParameterSpec.Builder(
                alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_BITS)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
    }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
    generator.init(builder.build())
    return generator.generateKey()
  }

  private fun deleteEntry(userId: String) {
    prefs.edit().remove(entryKey(userId)).apply()
    try {
      keyStore().deleteEntry(alias(userId))
    } catch (error: Exception) {
      // Nothing there to delete.
    }
  }

  private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

  private fun alias(userId: String): String = "com.myorganizer.vault.masterkey.$userId"

  private fun entryKey(userId: String): String = "masterkey.$userId"

  private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

  private fun decode(text: String): ByteArray = Base64.decode(text, Base64.NO_WRAP)

  companion object {
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val PREFS = "com.myorganizer.biometrickeystore"
    private const val SEPARATOR = ":"
    private const val KEY_BITS = 256
    private const val TAG_BITS = 128

    const val E_CANCELLED = "E_CANCELLED"
    const val E_INVALIDATED = "E_INVALIDATED"
    const val E_MISSING = "E_MISSING"
    const val E_FAILED = "E_FAILED"
  }
}
