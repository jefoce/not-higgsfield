# Not Higgsfield

> Make AI videos on your own computer. Pick a model, describe the shot, add pictures or clips if you like, and press Generate. Every video you make stays on your computer, together with the exact settings and what it cost.

![Screenshot](docs/screenshot.png)

## What you can do

- Turn a text description into a video.
- Start from a picture, or give a start picture and an end picture.
- Add reference pictures, video clips or sound, and point to them in your text ("the person in Image 1").
- Browse everything you made, search it, and make it again with one click.
- Keep working while videos generate. You get a notification when one is ready.

## What you need

- A Mac (Apple Silicon), a Windows 10/11 PC, or a 64-bit Linux computer.
- An OpenRouter account with some credit. OpenRouter is a service that gives you access to many AI video models with one account, and you pay only for what you generate.
- Optional: a Cloudflare R2 bucket. Some models only accept video or sound references as web links, and R2 gives the app a private place for them. Not needed for text or pictures.

## Install

Download the file for your computer from the [Releases page](https://github.com/your-name/not-higgsfield/releases/latest).

> Installers bundle a custom ffmpeg 9.0.2 build with x264 and zlib, built from pinned sources. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### macOS
1. Download the `.dmg`, open it, and drag Not Higgsfield into Applications.
2. Open the app. The first time, macOS blocks it because it is not from the App Store or a registered developer.
3. Open System Settings > Privacy & Security, scroll down, and press Open Anyway next to Not Higgsfield. Confirm once more.
4. If macOS says the app "is damaged", open Terminal and run:
   `xattr -dr com.apple.quarantine "/Applications/Not Higgsfield.app"`
   Then open the app again. This only removes the "downloaded from the internet" flag.
5. When macOS asks whether Not Higgsfield may use your confidential information, choose Always Allow. This lets the app keep your keys in the macOS Keychain. It can ask again after an update.

### Windows
1. Download the `-setup.exe` and run it.
2. If Windows shows "Windows protected your PC", press More info, then Run anyway. This appears because the app is not signed with a paid certificate.
3. The installer adds Not Higgsfield to the Start menu. No administrator rights needed.

### Linux
- AppImage (any distribution): download it, make it executable (`chmod +x not-higgsfield_*.AppImage`), and run it. On Ubuntu 22.04 and newer you may need `libfuse2` once: `sudo apt install libfuse2` (on 24.04 the package is `libfuse2t64`).
- Debian or Ubuntu: `sudo apt install ./not-higgsfield_*_amd64.deb`. This also installs the video playback libraries.
- Your keys are stored in your desktop's keyring (GNOME Keyring or KWallet). Without one, they are stored in a private file in your home folder, and Settings tells you so.

### Check your download (optional)
Each release has a `SHA256SUMS.txt`. Compare it with `shasum -a 256 <file>` (macOS, Linux) or `Get-FileHash <file>` (Windows PowerShell).

## First setup

### 1. Connect OpenRouter
1. Create an account at openrouter.ai and add credit.
2. Create an API key. Set a credit limit on the key, for example 5 dollars. Then a mistake can never spend more than that.
3. In Not Higgsfield, press the gear icon, paste the key under OpenRouter, press Save, then Test.

### 2. Connect Cloudflare R2 (only if you need it)
You need this only to use video or sound references with Wan or Seedance. The app tells you when a model needs it.
1. In Cloudflare, create an R2 bucket.
2. Create an API token with "Object Read & Write" for that bucket only.
3. In Settings, fill in Account ID, Access key ID, Secret access key and bucket name. Press Save, then Test.

R2 has a free tier that covers normal use. The app removes files from your bucket that it has not used for 30 days.

## Make your first video

1. Choose a model under Model. Wan 3.0 at 480p and a short duration is the cheapest way to try.
2. Write what should happen in the video.
3. Optional: add a start picture (Frames tab) or references (References tab). In your text, refer to references as Image 1, Video 1, Audio 1.
4. The Generate button shows the estimated price. Press it.
5. You have 10 seconds to press Cancel. Nothing is sent or paid before that.

## Keep the app running until your video is done

This is the one thing to remember.

Videos are made on OpenRouter's side, but the app is what brings the finished file to your computer. OpenRouter keeps a finished video only for a limited time, and it does not say how long. For some models it is about a day.

- **macOS:** the red close button only hides the window. The app keeps working in the background, and you get a notification when a video is ready. To really quit, use Not Higgsfield > Quit or Cmd+Q.
- **Windows and Linux:** closing the window quits the app.
- If you quit while videos are still in progress, the app asks first. If you quit anyway, the videos keep generating, and the app downloads them the next time you open it. Open it again within a few hours.
- Don't let your computer sleep for a long time in the middle of a generation. A sleeping computer cannot download.

## What the statuses mean

| Status | What is happening | Cancel? | Charged? | OK to quit? |
|---|---|---|---|---|
| Processing | Waiting 10 seconds before sending | Yes | No | Better not. If the app is closed for more than a minute, this video is not sent. |
| Uploading | Sending your reference files to R2 | No | No | No. It stops and shows Failed. |
| Sending | Handing the job to OpenRouter | No | Maybe | If you quit, the app finishes sending first (up to a minute). If the computer crashes here, check OpenRouter's activity page before trying again. |
| In queue | OpenRouter accepted it and is waiting for the model | No | When it finishes | Yes, briefly. Reopen within a few hours. |
| Generating | The model is making your video | No | When it finishes | Yes, briefly. Reopen within a few hours. |
| Downloading | Saving the finished video to your computer | No | Yes | No. Wait a moment. |
| Completed | Saved on your computer | No | Yes | Yes |
| Failed | Something went wrong. The card says what. | No | Usually not | Yes |
| Expired | The model took too long, or the finished video was gone before the app could download it | No | Possibly, if it finished | Yes |
| Cancelled | You cancelled it, or it was never sent | No | No | Yes |

The real cost is shown in each video's details once OpenRouter reports it.

## Where your videos are

Everything is in one folder in your home folder: `.not-higgsfield` (hidden by default; on macOS press Cmd+Shift+. in Finder to show hidden folders).

- `downloads` has your videos, a preview picture, and a small settings file for each one.
- `uploads` has pictures and clips you pasted or dropped in. Files you picked from your disk are not copied, the app just remembers where they are. Moving or deleting the original makes them show as missing.
- `.cache` holds thumbnails. Safe to delete.
- `runtime/<version>` is the app's own private copy of its server, about 44 MB. Created on first launch or after an update. Safe to delete while the app is closed, it is recreated next launch. You can leave it out of backups.

To back up, copy the whole folder. To move to a new computer, copy the folder and enter your keys again.

## Costs

- The Generate button shows an estimate before you start.
- The real cost from OpenRouter is saved with every video.
- The wallet pill at the top shows how much is left on your key (or your balance, if you add the optional management key).
- Not Higgsfield is free and adds no fee.

## Privacy

- The app runs only on your computer. No account, no tracking, no server of ours.
- Your keys are stored in your system's keychain. On Linux without one, the app uses a private file in your home folder and tells you so.
- Your text and pictures go to OpenRouter and the model's provider to make the video. Video and sound references go to your own R2 bucket, as private links that stop working after 2 hours.

## Something went wrong?

| What you see | What to do |
|---|---|
| "OpenRouter key is not set" | Open Settings (gear icon) and save your key. |
| "needs cloud storage (R2)" | This model needs R2 for video or sound references. Set up R2, or use pictures. |
| "takes video references as mp4 or mov" | Convert the clip to mp4, or pick another file. |
| Settings says "Waiting for keychain access" | A system prompt is open, maybe behind other windows. Find it and choose Always Allow. |
| A video says Expired | Make it again with Reuse. Check OpenRouter's activity page to see if it was charged. |
| macOS says the app is damaged | See the Install section, step 4. |
| Windows says "Windows protected your PC" | Press More info, then Run anyway. |
| Videos don't play on Linux | Install the `.deb`, or the GStreamer packages: `gstreamer1.0-plugins-good gstreamer1.0-libav`. |
| Anything else | The log file is in `.not-higgsfield/logs/server.log`. Include its last lines when you report a problem. |

## Uninstall

1. Delete the app (macOS: drag it from Applications to the Trash. Windows: Settings > Apps. Linux: delete the AppImage, or `sudo apt remove not-higgsfield`).
2. Delete the `.not-higgsfield` folder in your home folder if you don't want to keep your videos.
3. Remove the saved keys: macOS Keychain Access, Windows Credential Manager, or your Linux keyring. Search for "not-higgsfield".

## For developers

Building, testing and how it works inside: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md).
