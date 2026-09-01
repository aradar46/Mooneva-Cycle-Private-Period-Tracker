# Changelog

All notable changes to Mooneva Cycle. Versions follow the Android `versionCode` / iOS build numbers used at release time.

## 2.3.0 — Android versionCode 18, iOS build 20

- **New: medication logging.** Record other medications and supplements alongside mood, symptoms, flow and discharge.
- Anything you type is now written to disk the moment the app goes to the background. Previously an edit made in the last second before you switched away could be lost.
- Coming back after a long break works properly again. The app used to show an empty calendar and claim your period was hundreds of days late; it now says there is no recent data and picks predictions back up as soon as you log one.
- Settings — including your PIN hash and lock timeout — are now encrypted on the device, matching how your cycle data was already stored.
- If the app cannot unlock your data on startup it now refuses to save over it, and explains what happened instead of showing an empty app.
- Fixed a case where a partially written PIN could lock you out of your own data with no way back in.
- Fixed several date errors that could put an entry on the wrong day depending on your timezone, including on daylight-saving changeover days. The calendar also notices midnight passing while it is open.
- Cycle day and phase now agree with each other on future dates, and period progress follows your adaptive cycle length instead of the fixed setting.
- Imports from Flo and Clue no longer invent periods you never logged, and a corrupt export can no longer flood the app with tens of thousands of entries.
- **New: Arabic and Turkish.** 14 languages in total, and Arabic joins Persian as a fully right-to-left layout.
- **Clinical report: choose a date range** before exporting, instead of always exporting everything. Fixed a crash that could stop the PDF from being generated at all.
- Onboarding now asks which day your week starts on, turns the fertile window on by default, and its period-logging instructions were rewritten in every language.
- Medication history now goes back 60 days instead of 30.
- Trends now says how many completed cycles a figure is based on, and its cycle-day numbers no longer shift by a day around daylight-saving changes.
- Predictions recover more sensibly when your most recent logged period is old.
- Calendar rework: clearer guide button, better contrast and readable text on dark theme.
- The fertility disclaimer in Settings is clearer about what the fertile-window estimate can and cannot tell you.
- 19 previously untranslated strings — including the backup warning and the data-error screen — are now translated in all 14 languages.

## 2.2.1 — Android versionCode 17, iOS build 19

- PIN is now stored as a salted PBKDF2-SHA256 hash instead of plain text, with a 5-attempt/30-second lockout against guessing. Existing PINs migrate automatically on next launch.
- Encrypted backups now use 600,000 PBKDF2 iterations (up from 100,000); older backups still restore correctly.
- Backup export defaults to password-protected, with an explicit warning if you disable it.
- Removed the storage permission entirely — the app no longer requests it at all.
- Fixed a bug where returning from the system file picker while importing a backup could incorrectly re-lock the app.
- Discrete mode now also hides the "P:"/"O:" countdown labels on the home-screen widget.
- Added a 25% voucher for Mooneva's own period-care products, reachable from Settings. Worth explaining why it's there: this app has no data model — no ads, no analytics, no selling what you log — so it earns nothing from you being here. The voucher points at the one thing that does fund development: Mooneva's physical products. It's opt-in, tucked in Settings, and asks nothing of you if you ignore it.

## 2.2.0 — Android versionCode 16, iOS build 18

- Added Hungarian, Russian and Portuguese (Brazilian) translations — 12 languages in total.
- Translations now load on demand instead of all at once, cutting the app bundle roughly in half and speeding up startup.
- Reworked the onboarding language picker: larger logo, native language names, flags removed.
- Fixed a scrolling issue that would have hidden the top of the language picker as the list grows.

## 2.1.0 — Android versionCode 15, iOS build 17

- Fixed reported UI bugs and improved dark-mode settings/report surfaces.
- Added responsive mood labels and a subtle calendar guide pulse.

## 2.0.9 — Android versionCode 14, iOS build 16

- Added a first-open **What’s New** popup with short release notes and a close button.
- Increased daily mood selection to five and added Mood swings and Sensitive moods.
- Added contraception reminders covering the pill, patch, ring, injection, IUD and implant, each on its own schedule with optional early warning.
- Improved imports and clearer reminder schedules.

## 2.0.8 — Android versionCode 13, iOS build 15

- Added Ukrainian and Italian locales.
- Mirrored Cycle Management as an onboarding step.

## 2.0.7 — Android versionCode 12, iOS build 14

- Reworked calendar month swiping: the grid now follows your finger and slides between months, with proper tap/flick thresholds.
- Fixed the period-start star and day-selection rings being cut off at the calendar edges.
- Protected-sex marker is now a filled shield; both sex markers are larger and no longer overlap the date on narrow screens.
- Clearer calendar guide text for logging periods and daily symptoms, updated in all seven languages.
- Added a pill timeline to Trends showing on which cycle days the pill was taken.

## 2.0.6

- Added importers for data from other period trackers (drip, Flo, Clue).
- Added French as a new app language.
- Added Joint Pain, Fever, and Chills symptom tags.
- Translation fixes across all languages

## 2.0.5

- Included the logo and fonts (public/) in the F-Droid public repo sync so the open-source build renders correctly.

## 2.0.4

- Fixed a timezone bug where dates in the PDF clinical report (including registered sex logs) could appear one day earlier than the calendar.

## 2.0.3

- Fixed the F-Droid build by removing the proprietary in-app-review plugin from the public build (Play Store build is unaffected).
- Pinned Capacitor core/android/ios/cli to 8.4.1 to stop version drift.

## 2.0.2

- Added a first-day-of-week setting so calendars can start on Monday, Sunday, or Saturday independent of app language.
- Added pill time logging with editable 24-hour times, calendar/preview badges, backup support, and clinical report output.
- Added the pill logged marker to the calendar guide.
- Moved advanced period options under the Flow tab and kept them visible but disabled until a period day is selected.
- Fixed trend heatmaps so mood and symptom row headers stay visible while scrolling across cycle days, including RTL layouts.
