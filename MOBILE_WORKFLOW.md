# Mobile Build Workflow

## How It Works

Brian prototypes in **bolt.new** → pushes to `dev` on GitHub → merges `dev` into `main` → I handle the rest.

## What to Message Me

Just tell me what changed. Examples:

- *"Pull latest and build for mobile"*
- *"New changes on dev — merge and sync to Xcode"*
- *"Updated the profile page, push to mobile"*

## What I Do When You Say "Pull & Build"

1. `git fetch --all`
2. `git checkout main && git pull origin main`
3. `git checkout mobile && git merge main`
4. `npm run build` — catch TypeScript/build errors
5. `npx cap sync ios` — sync web assets to iOS project
6. `git add . && git commit && git push origin mobile`
7. Report: ✅ ready for Xcode, or ❌ what broke and how to fix it

## What Brian Does After

1. Open Xcode: `npx cap open ios` (or open `ios/App/App.xcworkspace`)
2. Test on simulator / physical device
3. Archive and submit via App Store Connect when ready

## Branch Strategy

```
bolt.new → dev (prototyping)
              ↓ merge
           main (stable)
              ↓ merge
           mobile (iOS builds)
```

## Prerequisites

- Git safe.directory configured ✅
- GitHub remote authenticated ✅
- npm build pipeline verified ✅
- Capacitor sync verified ✅
- Code signing: handled by Xcode (Brian's certs/profiles)

## Notes

- Build warnings (chunk size, dynamic imports) are non-blocking
- `@capacitor/core` version mismatch with `@capacitor/ios` — cosmetic, works fine
- OpenClaw workspace files (AGENTS.md, SOUL.md, etc.) are untracked and won't interfere with merges
