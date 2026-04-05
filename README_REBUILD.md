# Joy of Cleaning Call Guide — Clean Rebuild

This is a fresh rebuild meant to replace the old layered version.

## What this rebuild includes

- Firebase email/password auth
- Inbound / Outbound groups
- Home screen with settings, import, export, and sign out
- Clean call screen with:
  - home button
  - top step tabs
  - script area only
  - Back / Next only
- Strict `script_blocks` rendering
- Per-call scratchpad values integrated into fields inside the script
- Native quote calculator modal inside the app
- Zillow lookup action that can fill sqft / beds / baths

## What this rebuild intentionally does NOT include yet

- Legacy fallback banners
- Phrase-detected fields
- Runtime branch buttons
- Old mixed renderer logic
- In-app visual flow editor

## File replacement instructions for the same GitHub repo/branch

1. Make a backup of your current repo folder.
2. In your repo working copy, delete everything except the hidden `.git` folder.
3. Copy all files from this package into the repo folder.
4. If you already have a working `js/firebase-config.js`, keep your existing values or paste them back in.
5. Add your Zillow / RapidAPI key to `js/quote-config.js`.
6. Commit and push to the same branch you already use for GitHub Pages.
7. Hard refresh the live site after deploy.

## Import / export format

For stability, this rebuild uses **strict JSON saved as `.txt`**.

That means exported files are text files, but the content is JSON.
This is easier to keep stable during the rebuild.

## Main rule for future content

If the txt says it, the app renders it.
If the txt does not say it, the app does not invent it.

## Current sample flow

The default workspace includes one block-native sample:
- Inbound → New Inquiry

Use that as the model for future call types.
