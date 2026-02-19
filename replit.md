# WhatsMiner Pulse - Fleet Dashboard

## Overview
Real-time WhatsMiner mining fleet monitoring dashboard with health alerts, performance tracking, and simulated miner data.

## Architecture
- **Frontend**: React + TypeScript + Vite, Shadcn UI, Recharts, Wouter routing, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Simulation**: Server-side miner simulation generates realistic telemetry data every 30 seconds

## Project Structure
- `client/src/pages/` - Dashboard, Miners, MinerDetail, Alerts, Settings pages
- `client/src/components/` - AppSidebar, ThemeProvider, ThemeToggle, StatusIndicator
- `client/src/lib/format.ts` - Utility formatters for hashrate, power, temperature, uptime
- `server/db.ts` - Database connection
- `server/storage.ts` - Data access layer (IStorage interface + DatabaseStorage)
- `server/simulation.ts` - Simulated miner telemetry polling
- `server/seed.ts` - Database seed data (8 miners, 24h history, alert rules, alerts)
- `shared/schema.ts` - Drizzle schemas (miners, minerSnapshots, alertRules, alerts)

## Key Features
- Fleet overview dashboard with real-time stats
- Individual miner detail with hashrate/temp/power charts
- Alert rules engine with threshold monitoring
- Dark/light theme support
- Simulated data for demo purposes (no real LAN miner access from cloud)

## Running
- `npm run dev` starts the Express server (port 5000) + Vite dev server
- Database schema auto-pushed on startup via `drizzle-kit push`
- Seed data inserted on first run

## Design Decisions
- Dark-first theme with amber/orange accent (mining industry feel)
- Font: Inter for UI, JetBrains Mono for monospace/data
- Sidebar navigation with fleet status summary
- 30-second polling interval for simulation snapshots
