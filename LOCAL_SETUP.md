# WhatsMiner Pulse — Local Setup Guide

Run WhatsMiner Pulse on your own PC so it can scan and monitor miners on your local network.

---

## What You Need

1. **A Windows, Mac, or Linux PC** on the same network as your miners
2. **Node.js 20+** — [Download here](https://nodejs.org/)
3. **PostgreSQL 15+** — [Download here](https://www.postgresql.org/download/)
4. **Git** — [Download here](https://git-scm.com/downloads)

---

## Step-by-Step Instructions

### Step 1: Download the Code

Option A — From GitHub (if you connected Replit to GitHub):
```
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

Option B — Download as ZIP from Replit:
1. In your Replit project, click the three dots menu (⋮) at the top left
2. Click "Download as ZIP"
3. Unzip the folder and open a terminal inside it

---

### Step 2: Install Dependencies

Open a terminal in the project folder and run:

```
npm install
```

This installs everything the app needs. It may take a minute or two.

---

### Step 3: Set Up PostgreSQL

You need a PostgreSQL database running on your PC.

**On Windows:**
1. Install PostgreSQL from the link above (use the installer)
2. During setup, set a password for the `postgres` user (remember this!)
3. Open **pgAdmin** or **SQL Shell (psql)** and create a database:
   ```sql
   CREATE DATABASE whatsminer_pulse;
   ```

**On Mac:**
1. Install with Homebrew: `brew install postgresql@15`
2. Start it: `brew services start postgresql@15`
3. Create the database:
   ```
   createdb whatsminer_pulse
   ```

**On Linux:**
1. Install: `sudo apt install postgresql`
2. Start: `sudo systemctl start postgresql`
3. Create the database:
   ```
   sudo -u postgres createdb whatsminer_pulse
   ```

---

### Step 4: Create a `.env` File

In the project folder, create a file called `.env` with these contents:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/whatsminer_pulse
SKIP_SEED=true
SESSION_SECRET=any-random-string-here
```

Replace `YOUR_PASSWORD` with the PostgreSQL password you set.

**What these do:**
- `DATABASE_URL` — tells the app where your database is
- `SKIP_SEED=true` — starts the app clean with no demo/test data
- `SESSION_SECRET` — can be any random text

---

### Step 5: Set Up the Database Tables

Run this command to create the database tables:

```
npx drizzle-kit push
```

---

### Step 6: Start the App

```
npm run dev
```

You should see output like:
```
12:00:00 PM [seed] SKIP_SEED=true — skipping demo data and simulation
12:00:00 PM [express] serving on port 5000
```

Open your browser and go to: **http://localhost:5000**

---

## Adding Your Miners

### Option 1: Network Scanner (Recommended)

1. Go to **Settings** in the sidebar
2. Under **Network Scanner**, click **Add IP Range**
3. Enter your miners' IP range:
   - **Name**: Something descriptive like "Building A"
   - **Start IP**: First IP in the range (e.g., `192.168.1.1`)
   - **End IP**: Last IP in the range (e.g., `192.168.1.254`)
   - **Port**: `4028` (default CGMiner API port)
4. Click **Add IP Range**, then click **Scan**
5. The app will probe each IP for a WhatsMiner device
6. Any miners found are automatically added and polled every 30 seconds

### Option 2: Add Miners Manually

1. Go to **Settings** in the sidebar
2. Under **Miners**, click **Add Miner**
3. Enter the miner's name, IP address, and port

---

## Troubleshooting

**"Cannot connect to database"**
- Make sure PostgreSQL is running
- Double-check the password and database name in your `.env` file

**"No miners found during scan"**
- Make sure your PC is on the same network as the miners
- Check that the IP range is correct
- Verify miners have CGMiner API enabled on port 4028
- Try pinging a miner's IP to confirm network connectivity

**App won't start**
- Make sure you ran `npm install` first
- Make sure Node.js 20+ is installed: run `node --version`
- Check that port 5000 isn't already in use

**Scan finds miners but no data appears**
- The poller runs every 30 seconds — wait a moment for data to appear
- Check the terminal for error messages from the poller

---

## Stopping the App

Press `Ctrl + C` in the terminal to stop the app.

To start it again later, just run `npm run dev` from the project folder.
