# Changelog

## 0.3.0 - unreleased

A roomier viewer with zoom, a live docked picker, paste and drop anywhere, and one copy per file.

### Added

- Videos loop until you pause them.
- A bigger media viewer with a blurred backdrop.
- Previous and next in the history viewer and in every preview list.
- Use button in every viewer: adds the media as a reference or start frame, by mode.
- Viewers start playback about half a second after opening or switching items.
- Zoom photos in the viewer: wheel or pinch, drag to move, buttons to zoom and fit.
- Photos in the viewer are never cropped, whatever their orientation.
- The media viewer has a close button in the corner.
- Photos and videos sit rounded on the blurred backdrop.
- Frames and input thumbnails open the preview with previous and next.
- Reuse closes the viewer so the loaded settings are visible.
- Drag files from Finder in the desktop app and they link without copying. Paste or drop works anywhere in the app, into the open picker or the active mode.

### Changed

- The media picker opens beside the generator. Clicking a file attaches or removes it right away, with no confirm step.
- Uploading or linking the same file again reuses the existing upload.
- The picker docks next to the references or frames box, opens only from Add, and closes on any click outside it.

### Fixed

- The Generate button shows no price, discount or spinner while it cannot run.
- With looping playback the player controls stay in sync, and pausing stops the loop.
- A model with no endpoint pricing block now logs a clear reason and keeps list prices.
- Release pipeline: sidecar and ffmpeg source pulls that hit GHCR are reused instead of rebuilt, and a hit now reaches the workflow step conditions.
- The preview shows Deselect for a selected file and keeps the list open while you pick.
- List rows toggle selection with a click, the same as the grid.
- Only the front dialog reacts to arrow keys.
- Dragging a zoomed photo follows the cursor without lag, and the zoom buttons no longer toggle the zoom.
- Videos and photos fill the viewer without black bars, whatever their shape.
- Dragging a zoomed photo moves it instead of starting a file drag.
- Every photo and video shows rounded corners on the media itself, whatever its shape.
- Long folder and uploads lists scroll without jumps.
- Picker tiles show the reference number, matching Image 2 and the other prompt tokens.
- Zoomed photos keep their rounded corners.
- Clicking Add again leaves the open picker unchanged.

## 0.2.0 - 2026-10-26

Provider and storage layers, stricter lint, stored data validation.

### Added

- The app tells you about new versions and installs them from Settings.
- Unavailable models show as disabled with the reason they cannot run.
- The cost estimate includes the seconds of reference videos.
- Reference durations show their exact values.
- Files chosen in the folder picker are marked before you press Add.
- Step-by-step setup guides for OpenRouter and Cloudflare R2, linked from Settings.
- Settings shows how much R2 storage the app uses.
- List view darkens the video edges on hover, like the grid.

### Fixed

- The Test button in Settings works in the packaged app.
- Glass surfaces no longer render a broken blur on Linux.
- R2 status refreshes after you save the settings.
- Credits no longer show the previous key's numbers after a key change.
- The Cloudflare links in Settings open from the desktop app.

### Changed

- The Linux AppImage steps name the correct FUSE package for Ubuntu 22.04 and 24.04.
- The app keeps R2 storage under 8 GB, inside Cloudflare's free tier, and removes the oldest unused references first.
- The Generate button no longer spins while it is disabled.

## 0.1.0 - 2026-10-22

First release.

### Added

- A local studio for Wan 3.0, Wan 3.0 Prime, Seedance 2.0 and Seedance 2.5, with text, start frame, start and end frames, and image, video or audio references.
- History with search, filters, rerun, thumbnails and previews, multi-select with batch download, like and delete, plus the real cost reported by OpenRouter.
- 4K image references with automatic size steps.
- Background generation with notifications, a visible Downloading stage and a summary of videos that changed while the app was closed.
- Optional Cloudflare R2 storage for models that need links, with 2 hour links and 30 day cleanup.
- macOS, Windows and Linux builds published to GitHub Releases, with checksums.
- Status tooltips and plain-language provider errors, with the raw provider detail available on demand.
- Downloads retry every minute when the disk is full.
- A custom Node 24 small-ICU runtime. The app is 138 MiB and the DMG is 50 MiB (measured).
- Keychain storage on macOS and Windows, keyring or a private file on Linux.
