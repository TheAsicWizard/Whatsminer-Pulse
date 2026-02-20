# WhatsMiner Pulse - Fleet Dashboard

## Overview
Real-time WhatsMiner mining fleet monitoring dashboard with health alerts, performance tracking, network scanning, and real miner polling via CGMiner API.

## Architecture
- **Frontend**: React + TypeScript + Vite, Shadcn UI, Recharts, Wouter routing, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Simulation**: Server-side miner simulation generates realistic telemetry data every 30 seconds
- **Scanner**: Network scanner discovers WhatsMiner devices via CGMiner TCP API (port 4028)
- **Poller**: Real miner poller queries discovered miners for live telemetry every 30 seconds

## Project Structure
- `client/src/pages/` - Dashboard, Miners, MinerDetail, Alerts, Settings pages
- `client/src/components/` - AppSidebar, ThemeProvider, ThemeToggle, StatusIndicator
- `client/src/lib/format.ts` - Utility formatters for hashrate, power, temperature, uptime
- `server/db.ts` - Database connection
- `server/storage.ts` - Data access layer (IStorage interface + DatabaseStorage)
- `server/simulation.ts` - Simulated miner telemetry polling (source="simulation")
- `server/scanner.ts` - Network scanner: IP range scanning, CGMiner API probe, real miner telemetry polling
- `server/poller.ts` - Real miner poller: polls miners with source="scanned" every 30s
- `server/seed.ts` - Database seed data (8 miners, 24h history, alert rules, alerts)
- `shared/schema.ts` - Drizzle schemas (miners, minerSnapshots, alertRules, alerts, scanConfigs)

## Key Features
- Fleet overview dashboard with real-time stats
- Individual miner detail with hashrate/temp/power charts
- Alert rules engine with threshold monitoring
- **Network Scanner**: IP range scanning to discover WhatsMiner devices via CGMiner API
- **Real Miner Polling**: Discovered miners are automatically polled for live data
- Dark/light theme support
- Simulated data for demo purposes alongside real miner support

## Running
- `npm run dev` starts the Express server (port 5000) + Vite dev server
- Database schema auto-pushed on startup via `drizzle-kit push`
- Seed data inserted on first run
- Simulation runs for demo miners, real poller runs for scanned miners

## Design Decisions
- Dark-first theme with amber/orange accent (mining industry feel)
- Font: Inter for UI, JetBrains Mono for monospace/data
- Sidebar navigation with fleet status summary
- 30-second polling interval for simulation and real miner snapshots
- Miners have `source` field: "simulation" (demo), "manual" (user-added), "scanned" (discovered by network scan)
- Network scanner uses TCP connections to CGMiner API (port 4028) with 3s timeout, 20 concurrent probes
- Max scan range: 1024 IPs per scan config
