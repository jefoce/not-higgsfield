# Changelog

## [0.1.0] - 2026-10-21

First release.

### Added

- A local studio for Wan 3.0, Wan 3.0 Prime, Seedance 2.0 and Seedance 2.5, with text, start frame, start and end frames, and image, video or audio references.
- History with search, filters, rerun, thumbnails and previews, plus the real cost reported by OpenRouter.
- Background generation with notifications, a visible Downloading stage and a summary of videos that changed while the app was closed.
- Optional Cloudflare R2 storage for models that need links, with 2 hour links and 30 day cleanup.
- macOS, Windows and Linux builds published to GitHub Releases, with checksums.
- Status tooltips and plain explanations for failed, expired and cancelled jobs.
- Keychain storage on macOS and Windows, keyring or a private file on Linux.

### Changed

- README rewritten for first time users. The model table moved to the architecture docs.
- Reference sorting uses pointer events, so it works on Windows.
- Quit waits for a job that is being sent, up to one minute.
- Closing the macOS window hides it and shows a one time hint.
- Docs tests now cover the status table, bounds and architecture model table.
- Removed the one-off `canonicalize-history.mjs` and `clean-record-errors.mjs` scripts after they ran.
- Quit dialog counts grace, uploading, sending, generating and downloading videos separately.
- Desktop installers bundle a custom ffmpeg 9.0.2 build with x264 and zlib, built from pinned sources, instead of the nonfree `ffmpeg-static` binary. Release jobs build the sidecar for each target, verify its license flags, and attach the source archives.

### Fixed

- A job still in its 10 second grace window when the app quit is cancelled at the next launch instead of sent hours later.
- Quitting while a job is being sent no longer loses the OpenRouter job id.
- Progress and download state are visible before the file is on disk.
- Windows file linking falls back from symlink to hard link to copy.
- Linux without a system keyring falls back to a private file.
- Keys load before queued submits resume.
- Quitting while a send is starting now waits for that send instead of cutting it.
- Discounted Seedance token rates keep their full precision.
- A denied keychain prompt on macOS or Windows shows an error and never falls back to a plain file.
- A full disk stops download retries, keeps the video for the next launch and shows a disk full message.
- Rust panics write the message and location to `desktop.log`.
- Hover actions no longer stay visible after a mouse click, while Tab focus still shows them.
