<div align="center">
  <img src="fastlane/metadata/android/en-US/images/icon.png" width="120" alt="Mooneva Cycle Icon" />
  <h1>Mooneva Cycle</h1>
  <p><strong>Private, offline period & cycle tracker — open source, no account, no cloud, no compromise.</strong></p>

  <a href="https://play.google.com/store/apps/details?id=com.mooneva.app&pcampaignid=web_share">
    <img src="https://img.shields.io/badge/Google_Play-Download-34A853?style=for-the-badge&logo=google-play&logoColor=white" alt="Get it on Google Play" />
  </a>
  &nbsp;
  <a href="https://apps.apple.com/us/app/mooneva-cycle/id6761208425">
    <img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=app-store&logoColor=white" alt="Download on the App Store" />
  </a>
  &nbsp;
  <a href="https://f-droid.org/en/packages/com.mooneva.app/">
    <img src="https://img.shields.io/badge/F--Droid-Download-1976D2?style=for-the-badge&logo=f-droid&logoColor=white" alt="Get it on F-Droid" />
  </a>

  <br /> 

  <img src="https://img.shields.io/github/license/aradar46/Mooneva-Cycle-Private-Period-Tracker?style=flat-square" alt="License: GPL-3.0" />
  <img src="https://img.shields.io/github/v/tag/aradar46/Mooneva-Cycle-Private-Period-Tracker?label=version&style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Android%20%7C%20iOS-lightgrey?style=flat-square" alt="Platform" />
</div>

---

## Contents

- [Why offline-first?](#why-offline-first)
- [Screenshots](#screenshots)
- [Demo](#demo)
- [About](#about)
- [Features](#features)
- [Privacy](#privacy)
- [Security](#security)
- [Building from Source](#building-from-source)
- [License](#license)
- [Links](#links)
- [Contributors](#contributors)
- [Release Log](#release-log)
- [Roadmap](#roadmap)
- [Support the project](#support-the-project)

---

## Why offline-first?

Most period trackers upload your data to corporate servers — data that has been sold to advertisers, exposed in breaches, and in some jurisdictions legally demanded by law enforcement. Mooneva is built on a different premise: **data that never leaves your device cannot be leaked or subpoenaed.**

There are no Mooneva servers. Your cycle data is encrypted on your device using PBKDF2/AES-GCM and never leaves it. The app requires no internet permission whatsoever — no health data is ever transmitted anywhere. If someone filed a legal request for user data, there would be nothing to hand over — not because we deleted it, but because we never had it.

---

<img src="fastlane/metadata/android/en-US/images/featureGraphic.png" alt="Mooneva Cycle Banner" width="100%" />

---

## Screenshots

<div align="center">
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/01.png" width="22%" alt="Calendar view" />
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/02.png" width="22%" alt="Daily log" />
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/03.png" width="22%" alt="Trends" />
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/04.png" width="22%" alt="Settings" />
</div>

---

## Demo

<div align="center">
  <video src="https://github.com/user-attachments/assets/2ae076d8-84af-4258-b0a4-16b5ff9aa081" width="320" controls muted playsinline></video>
</div>

---

## About

Mooneva Cycle is developed by **[Mooneva](https://mooneva.se/)**, a Swedish femtech company dedicated to building thoughtful tools for women's health. Learn more at [mooneva.se/pages/mooneva_cycle](https://mooneva.se/pages/mooneva_cycle).

---

## Features

- **Cycle & period tracking** with smart predictions
- **Fertile window & ovulation** estimates
- **Daily log** — mood, symptoms, flow intensity, discharge
- **PMS window** warnings
- **Trends & history** across multiple cycles
- **Clinical report** export (PDF)
- **Discrete mode** — disguises the app icon and name
- **PIN lock** with configurable timeout
- **Reminder notifications** (period, ovulation, daily log, PMS, Pill)
- **Contraception reminders** — pill, patch, ring, injection, IUD, implant
- **Birth control mode** — hides fertile window, tags bleeds as withdrawal
- **Pill tracking** — log intake time, see adherence per cycle day in Trends
- **Dark theme**
- **Data import** from drip, Flo, and Clue
- **12 languages** — English, German, Spanish, Swedish, Chinese, Persian, French, Ukrainian, Italian, Hungarian, Russian, Portuguese
- **Persian (Jalaali) calendar** and full RTL support

---

## Privacy

Mooneva Cycle collects no data. There are no analytics, no crash reporters, no third-party SDKs that phone home.

| Cloud-based trackers | Mooneva |
|---|---|
| Data stored on company servers | Data stored only on your device |
| Vulnerable to breaches | No server exists to breach |
| Subject to legal subpoenas | No centralised data to subpoena |
| Requires account with personal info | No account, no registration |
| Company can analyse your data | We cannot see your data — ever |

---

## Security

Threat model, exact crypto parameters (AES-256-GCM, PBKDF2 iteration counts), permission list, and known limitations are all in [SECURITY.md](SECURITY.md). Report vulnerabilities there, not as a public issue.

---

## Building from Source

### Requirements

- Node.js 20+
- npm
- Android Studio (for Android) / Xcode (for iOS)

### Steps

```bash
# Install dependencies
npm install

# Run in browser
npm run dev

# Build web assets
npm run build

# Sync and open Android
npx cap sync android
npx cap open android

# Sync and open iOS
npx cap sync ios
npx cap open ios
```

---

## License

Copyright (C) 2026 Måneva AB

Licensed under the [GNU General Public License v3.0 or later](LICENSE).

Any modified version you distribute must also be open-sourced under GPL-3.0-or-later.

---

## Links

- Website: [mooneva.se](https://mooneva.se/)
- App page: [mooneva.se/pages/mooneva_cycle](https://mooneva.se/pages/mooneva_cycle)
- Google Play: [com.mooneva.app](https://play.google.com/store/apps/details?id=com.mooneva.app&pcampaignid=web_share)
- App Store: [Mooneva Cycle](https://apps.apple.com/us/app/mooneva-cycle/id6761208425)
- Issue tracker: [GitHub Issues](https://github.com/aradar46/Mooneva-Cycle-Private-Period-Tracker/issues)

---

## Contributors

- [@octantblow](https://github.com/octantblow) — French translation
- [@reginanka](https://github.com/reginanka) — Ukrainian translation
- [@pihentagy](https://github.com/pihentagy) — Hungarian translation

---

## Release Log

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## Roadmap

### In progress

- fixing bugs and tweak user friendliness
- adding more language support

### Planned

- Zero-knowledge cross-device sync — encrypted client-side,
  server sees only opaque blobs. Device pairing via QR code
  and ECDH key exchange. Opt-in and sandboxed so the
  zero-internet-permission guarantee holds for users who
  skip it.

Have a feature request? Open an [issue](https://github.com/aradar46/Mooneva-Cycle-Private-Period-Tracker/issues) and let us know.

---

## Support the project

Mooneva Cycle is free, open source, and built without any VC funding or commercial data model. If it is useful to you, the best things you can do are:


- Star the repo
- Share it with anyone who cares about health data privacy
- Help us to list the app in privacy-focused listings
- Report bugs or suggest features via [GitHub Issues](https://github.com/aradar46/Mooneva-Cycle-Private-Period-Tracker/issues)
- Leave a review on [Google Play](https://play.google.com/store/apps/details?id=com.mooneva.app) or the [App Store](https://apps.apple.com/us/app/mooneva-cycle/id6761208425)
 
