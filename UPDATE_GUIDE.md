# Updating Your Local WhatsMiner Pulse

You already have a working local copy. Follow these steps to get the latest features (MAC address tracking, Foreman CSV import, container/rack layout updates).

---

## Option A: Download Fresh ZIP (Easiest)

1. In your Replit project, click the three dots menu at the top left
2. Click **"Download as ZIP"**
3. Unzip it into a new folder (don't overwrite your `.env` file!)
4. Copy your `.env` file from your old folder into the new one
5. Open a terminal in the new folder and run:
   ```
   npm install
   npx drizzle-kit push
   npm run dev
   ```

That's it — you're updated.

---

## Option B: Update Individual Files

If you prefer to update just the changed files, copy these files from this Replit project into your local Whatsminer-Pulse folder, replacing the old versions:

### Files to Replace

**Database & shared types:**
- `shared/schema.ts`

**Server files:**
- `server/index.ts`
- `server/routes.ts`
- `server/storage.ts`
- `server/scanner.ts`
- `server/poller.ts`
- `server/simulation.ts`
- `server/seed.ts`

**Frontend files:**
- `client/src/pages/dashboard.tsx`
- `client/src/pages/miners.tsx`
- `client/src/pages/miner-detail.tsx`
- `client/src/pages/settings.tsx`
- `client/src/components/site-map.tsx`
- `client/src/components/assign-miner-dialog.tsx`

**Config:**
- `package.json`
- `package-lock.json`

### After Copying the Files

Open a terminal in your project folder and run:

```
npm install
npx drizzle-kit push
npm run dev
```

**Note:** The `drizzle-kit push` command will add new columns and tables to your database. Your existing miner data will be preserved — it only adds, never deletes. But if you want to be safe, back up your database first with `pg_dump whatsminer_pulse > backup.sql`.

The `npm install` will add the new packages needed (multer for file uploads, xlsx for spreadsheet parsing).

The `drizzle-kit push` will update your database tables to add the new columns (MAC address, serial number) and the new MAC mapping table.

---

## What's New

- **14 racks x 40 slots per container** — matches your real site layout (4 columns x 10 rows per rack)
- **Grey squares** for empty physical rack positions (not miners)
- **MAC address tracking** — scanner now captures MAC from CGMiner API
- **Foreman CSV import** — upload your Foreman export to map MACs to physical positions
- **Auto-assign by MAC** — after scanning, miners get placed in the correct container/rack/slot automatically based on their MAC address
- **MAC shown in tooltips and miner detail** — see MAC address when hovering over miners or viewing details

## Using the Foreman CSV Import

1. Start the app and go to **Settings**
2. Scroll down to **Foreman CSV Import**
3. Click **Choose File** and select your Foreman CSV export
4. Click **Import CSV** — this loads the MAC-to-position mappings
5. Run a network scan to discover your miners (the scanner captures MAC addresses)
6. Click **Assign by MAC** to automatically place miners in their correct physical positions

If a miner's IP changes later (DHCP), just rescan — the app matches by MAC address so the miner stays in its correct position.
