# EAS Update (OTA) — setup & workflow

Lets us ship **JS / UI fixes over the air** to TestFlight + App Store builds
without an App Store review. Content (questions, clues, daily sets, scores)
is *already* OTA — it lives in Supabase and is fetched at runtime, so adding
questions never needs a build or an update. This is only for **app code**.

## What's already wired (in the repo)
- `expo-updates` installed (`mobile/package.json`).
- `mobile/eas.json` — build profiles + channels: `development`, `preview`, `production`.
- `app.json` → `runtimeVersion.policy = "fingerprint"` (an OTA update only lands on a
  build whose native fingerprint matches; native/SDK changes auto-require a new build).

## One-time setup (needs your Expo account — run locally)
```bash
cd mobile
npm i -g eas-cli          # if not installed
eas login                 # your Expo account
eas init                  # creates the EAS project, writes extra.eas.projectId into app.json
eas update:configure      # adds updates.url (https://u.expo.dev/<projectId>) to app.json
```
Commit the `app.json` changes those commands make (projectId + updates.url).

> iOS/Android `bundleIdentifier`/`package` aren't set yet — `eas build` will prompt
> and write them on the first build. Pick them deliberately; they're painful to change
> once submitted to the stores.

## Build (per channel)
```bash
eas build --profile preview --platform ios       # internal/TestFlight-style test build
eas build --profile production --platform ios     # store build
eas submit --profile production --platform ios     # upload to App Store Connect
```
A build is locked to its channel (`preview` build ← `preview` updates, etc.).

## Ship a JS/UI fix OTA (the payoff — no review)
```bash
eas update --branch production --message "fix: <what changed>"
```
Installed apps on that channel pick it up on next launch (fingerprint must match).
Use `--branch preview` to test on internal builds first.

## When you STILL need a full rebuild + submit
- New native module / Expo SDK bump / changes to native `app.json` config.
- The fingerprint policy detects these and refuses to apply an incompatible OTA update,
  so you can't accidentally push JS that needs a native change the build doesn't have.

## Rule of thumb
| Change | How it ships |
|---|---|
| Questions / clues / daily / scores | Supabase import — instant, no build |
| DB schema migration (back-compatible) | Apply to Supabase — no app build |
| JS / UI / logic | `eas update` — OTA, no review |
| Native / SDK / app config | `eas build` + `eas submit` — store review |
