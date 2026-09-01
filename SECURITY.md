# Security Policy

## Reporting a Vulnerability

Report privately via [GitHub Security Advisories](https://github.com/aradar46/Mooneva-Cycle-Private-Period-Tracker/security/advisories/new), or email **app@mooneva.se**.

Please do not open a public issue for a security bug. Expect an acknowledgement within 7 days. Fixes ship in the next release; you will be credited unless you ask otherwise.

Supported: the latest released version only.

## Threat Model

Mooneva Cycle is designed against one primary adversary: **anyone who gets your data off a server**, including the developer, an advertiser, a breach, or a subpoena.

The app has no servers. It does not declare `android.permission.INTERNET`, so the operating system itself prevents any network transmission.

### Permissions

The full set the app declares or merges in:

| Permission | Source | Why |
|---|---|---|
| `POST_NOTIFICATIONS` | app | Period, ovulation, PMS, pill and daily-log reminders |
| `SCHEDULE_EXACT_ALARM` | app | Delivers reminders at the time you set, instead of whenever the system next batches alarms |
| `RECEIVE_BOOT_COMPLETED` | `@capacitor/local-notifications` | Re-registers pending reminders after a reboot |
| `WAKE_LOCK` | `@capacitor/local-notifications` | Delivers a scheduled reminder on a sleeping device |
| `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX | Auto-added, guards the plugin's internal receiver |

Notably absent: `INTERNET`, `ACCESS_NETWORK_STATE`, storage, location, contacts, camera, microphone, and any account permission. `SCHEDULE_EXACT_ALARM` is declared so a reminder arrives at the time you chose; without it Android may batch a pill reminder minutes or hours late. It grants no access to data and no network reach. Backup export goes through `@capacitor/filesystem` + `@capacitor/share` to the app's own cache, which needs no storage permission; import goes through the system file picker. `android:allowBackup="false"` also keeps ADB and OS cloud-backup from pulling app data off the device.

Secondary adversary: **someone who picks up your unlocked phone.** PIN lock and Discrete mode address this, imperfectly (see Limitations).

Explicitly **out of scope**: a rooted device, a compromised OS, a forensic image taken with the device unlocked, or a targeted attacker with physical access and time. On-device encryption at rest cannot defend against these, and Mooneva does not claim to.

## Cryptography

All primitives come from the WebCrypto API (`crypto.subtle`) provided by the platform WebView. No custom crypto is implemented.

### Data at rest

| | |
|---|---|
| Cipher | AES-256-GCM, 96-bit random IV per write |
| Key derivation | PBKDF2-HMAC-SHA256, 100,000 iterations |
| Input keying material | 256-bit random device secret, generated on first launch |
| Salt | 128-bit random, generated on first launch |
| Secret storage | Android Keystore / iOS Keychain via `capacitor-secure-storage-plugin` |

The device secret is not derived from anything the user knows; it exists only in the platform keystore. Cycle records and daily logs are stored encrypted; nothing is transmitted anywhere.

### Encrypted backups

| | |
|---|---|
| Cipher | AES-256-GCM, 96-bit random IV |
| Key derivation | PBKDF2-HMAC-SHA256, 600,000 iterations, 128-bit random salt |
| Input keying material | User-chosen password |
| Format | 1-byte version tag (currently 2), salt, IV, ciphertext |

600,000 iterations meets the current OWASP recommendation. Backups written by earlier releases carry version tag 1 and are still readable at their original 100,000 iterations; the version tag selects the count. There is no recovery path for a lost password. That is intentional.

### PIN lock

The PIN is never stored in plaintext. It is hashed with PBKDF2-HMAC-SHA256 (100,000 iterations, 128-bit random salt) and only the hash and salt are persisted; verification is done against the hash. Guessing is rate-limited: 5 failed attempts trigger a 30-second lockout.

Relevant code: [`services/logic/storage.ts`](services/logic/storage.ts), [`utils/pin.ts`](utils/pin.ts).

## Known Limitations

Stated plainly, because a security policy that only lists strengths is marketing.

1. **The cryptography has not been independently audited.** It is standard WebCrypto usage with no novel constructions, but no third party has reviewed it.  
2. **Data at rest uses 100,000 PBKDF2 iterations**, below the OWASP recommendation of 600,000. This is deliberate and low-impact: the input keying material there is a 256-bit random secret held in the platform keystore, not a guessable password, so the iteration count is not what stands between an attacker and the key. Password-derived **backups**, where the count genuinely matters, use 600,000.
3. **The PIN is a UI gate, not a decryption boundary.** Even hashed, it stops a curious person holding your phone; it does not stop anyone who can read app-private storage directly, since data-at-rest encryption is bound to the keystore secret, not the PIN.
4. **No protection on a rooted or compromised device.** The keystore-backed secret raises the bar, but an attacker with root can reach what the app can reach.
5. **Discrete mode is disguise, not security.** It changes the icon, name, and home-screen widget text. It does not hide the package from anyone who looks at the installed app list.
6. **Screenshots and backgrounding.** The app does not set `FLAG_SECURE`; content may appear in the OS task switcher.
7. **Exported PDF reports are plaintext** by design, since they are meant for a doctor. Where they land after export is outside the app's control.

## Verification

- **Independent report:** [Exodus Privacy: com.mooneva.app](https://reports.exodus-privacy.eu.org/en/reports/773571/). Static analysis of the build, confirming 0 trackers and no internet permission.
- **Zero network access:** the missing `INTERNET` permission is checkable in the manifest and in the APK itself.
- **Zero trackers:** no analytics, crash reporting, or advertising SDK is present in [package.json](package.json).
- **Reproducibility:** builds are published on F-Droid from this source.
