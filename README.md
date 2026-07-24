# Production Dashboard

A mobile production tracking dashboard built with Expo, React Native, TypeScript, and Google Apps Script. The app turns Google Sheets rows into a touch-friendly production board where operators can view tasks by project, lot, and stock code, then update each item's production status from a phone or tablet.

## What It Does

- Reads production task rows from Google Sheets through a Google Apps Script Web App.
- Groups work by project, lot, and stock code.
- Shows completion progress with summary cards and a progress ring.
- Lets users toggle task status between `To run` and `Completed`.
- Writes updates back to the correct spreadsheet row.
- Supports local caching and offline pending actions with AsyncStorage.
- Includes an internal login screen and APK update check flow.

## Tech Stack

- Expo 54
- React Native 0.81
- React 19
- TypeScript
- Expo Router
- AsyncStorage
- NetInfo
- React Native SVG
- Google Apps Script
- EAS Build

## Architecture

```text
Expo React Native App
  -> Dashboard API wrapper
  -> Google Apps Script Web App
  -> Google Drive folder
  -> Multiple Google Spreadsheets
```

The frontend handles UI state, filtering, cached data, optimistic updates, and offline pending actions. The Apps Script backend scans configured Google Sheets, detects relevant headers, returns dashboard items as JSON, and writes status updates back to the `REMARKS` column.

## Key Files

- `app/(tabs)/index.tsx` - main dashboard screen
- `hooks/use-dashboard-data.ts` - data loading, caching, offline queue, and update flow
- `services/api.ts` - API request wrapper with timeout and retry behavior
- `utils/dashboard.ts` - data normalization and view-model transformation
- `components/dashboard/` - dashboard UI components
- `contexts/auth-context.tsx` - local session handling
- `backend-fixed-no-lock.gs` - Google Apps Script backend template
- `APP_TECHNICAL_REPORT_CN.md` - Chinese technical report for interview preparation

## Setup

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Update `.env` with your Apps Script deployment URL and token:

```bash
EXPO_PUBLIC_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
EXPO_PUBLIC_API_TOKEN=YOUR_API_TOKEN
EXPO_PUBLIC_API_KEY=YOUR_API_KEY
```

Start the app:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on web:

```bash
npm run web
```

## Backend Setup

1. Open Google Apps Script.
2. Copy the contents of `backend-fixed-no-lock.gs`.
3. Set `CONFIG.FOLDER_ID` to the Google Drive folder that contains your production spreadsheets.
4. Set `CONFIG.TOKEN` to the same value as `EXPO_PUBLIC_API_TOKEN`.
5. Deploy as a Web App.
6. Copy the Web App URL into `.env`.

The backend expects sheets that include a `REMARKS` header and uses `spreadsheetId + sheetName + rowNumber` to write updates back to the correct row.

## Build

Preview APK:

```bash
npx eas build --platform android --profile preview
```

Production Android App Bundle:

```bash
npx eas build --platform android --profile production
```

## Security Notes

Do not commit `.env` or real API credentials. Public configuration files use placeholders, and runtime values should come from environment variables or a private EAS environment.

The current login flow is designed for a small internal tool. For a broader production deployment, replace the fixed local credential check with server-side authentication and stronger API authorization.

## Interview Notes

The project is useful to discuss as an example of:

- converting an existing Google Sheets workflow into a mobile production tool;
- building a reliable touch UI for production operators;
- isolating messy spreadsheet data behind a typed frontend view model;
- handling low-connectivity environments with cache and pending-sync state;
- using Google Apps Script as a lightweight backend before investing in a full database service.

