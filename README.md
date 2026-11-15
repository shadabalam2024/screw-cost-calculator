# Screw Cost Calculator

Offline Windows desktop app for calculating screw manufacturing cost. All data is stored locally in SQLite (`%APPDATA%\Screw Cost Calculator\screw.db`); nothing is sent anywhere.

## Install
Download the latest `Screw-Cost-Calculator-Setup-x.y.z.exe` from [Releases](../../releases/latest) and run it. The app checks for updates on launch and offers to restart once one is downloaded.

## Develop
```
npm install
npm start
```

## Publish an update
1. Bump `version` in `package.json`.
2. Commit, then tag and push:
```
git tag v1.0.1
git push && git push --tags
```
GitHub Actions builds the installer and attaches it to a release; installed apps pick it up automatically. The tag must match `package.json` version.
