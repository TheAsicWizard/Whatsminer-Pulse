# WhatsMiner Pulse - Fleet Dashboard

## Overview
Real-time WhatsMiner mining fleet monitoring dashboard with health alerts, performance tracking, network scanning, and real miner polling via CGMiner API.

## Architecture
- **Frontend**: React + TypeScript + Vite, Shadcn UI, Recharts, Wouter routing, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Simulation**: Server-side miner simulation generates realistic telemetry data every 60 seconds
- **Scanner**: Network scanner discovers WhatsMiner devices via CGMiner TCP API (port 4028)
- **Poller**: Real miner poller queries discovered miners for live telemetry every 30 seconds

## Project Structure
- `client/src/pages/` - Dashboard, Miners, MinerDetail, Alerts, Settings pages
- `client/src/components/` - AppSidebar, ThemeProvider, ThemeToggle, StatusIndicator, SiteMap, AssignMinerDialog
- `client/src/lib/format.ts` - Utility formatters for hashrate, power, temperature, uptime
- `server/db.ts` - Database connection
- `server/storage.ts` - Data access layer (IStorage interface + DatabaseStorage)
- `server/simulation.ts` - Simulated miner telemetry polling (source="simulation")
- `server/scanner.ts` - Network scanner: IP range scanning, CGMiner API probe, real miner telemetry polling
- `server/poller.ts` - Real miner poller: polls miners with source="scanned" every 30s
- `server/seed.ts` - Database seed data (47 containers, 22K+ miners, alert rules)
- `shared/schema.ts` - Drizzle schemas (miners, minerSnapshots, alertRules, alerts, scanConfigs, containers, slotAssignments, macLocationMappings)

## Key Features
- Fleet overview dashboard with real-time stats and Site Map visualization
- **Site Map (Top-Down Aerial View)**: Bird's-eye view of the entire mine site showing containers as colored rectangles in rows (8 per row)
  - Color-coded by health: green=healthy, amber=warnings, red=critical issues, gray=offline/empty
  - Mini health bars on each container showing status breakdown
  - Hover tooltips with quick stats (online/total miners, hashrate, power, avg temp)
  - Click any container to drill into rack/slot detail view with "Back to Site Map" navigation
  - Zoom in/out/reset controls + mouse wheel zoom + click-and-drag pan
  - Dot-grid background for spatial reference, container/miner counts in bottom-left
- **Container Management**: Hierarchical Container > Rack > Slot layout with drill-down from site map
  - Site Builder in Settings for creating/editing containers with rack count, slots per rack, IP ranges
  - Auto-assign miners to slots by IP range matching
  - Interactive slot assignment: click empty slot to assign, replace/swap for RMAs (in rack detail view)
  - Container-level summary stats (online count, hashrate, power, avg temp)
  - Naming convention: C188-01-02 (Container-Rack-Slot)
- Individual miner detail with hashrate/temp/power charts
- Grid/List view toggle on Miners page with server-side pagination
- Alert rules engine with threshold monitoring
- **Network Scanner**: IP range scanning to discover WhatsMiner devices via CGMiner API
- **Real Miner Polling**: Discovered miners are automatically polled for live data
- **Foreman CSV Import**: Upload Foreman CSV export to map MAC addresses to physical container/rack/slot positions
  - Parses miner_mac, miner_rack (e.g. C260-R008), miner_row, miner_index columns
  - Stores MAC-to-position mappings in mac_location_mappings table
  - Auto-assigns miners to correct slots by matching MAC addresses after network scan
  - Scanner captures MAC address from CGMiner API (summary, stats, get_miner_info commands)
  - If a miner's IP changes (DHCP), rescan detects same MAC and updates the IP without losing position
- Dark/light theme support
- Simulated data for demo purposes alongside real miner support

## Performance Optimizations
- **latestSnapshotId**: Miners table has `latest_snapshot_id` column pointing to most recent snapshot, eliminating expensive `max(createdAt)` subqueries
- **Database Indexes**: Comprehensive indexes on miner_snapshots (miner_id, created_at), alerts (miner_id, acknowledged), slot_assignments (container_id, miner_id), miners (status, source, latest_snapshot_id)
- **Paginated API**: `/api/miners` returns `{ miners, total }` with pagination, search, and status filter support
- **Container summaries**: Lightweight `/api/containers/summary` endpoint uses JOINs with latestSnapshotId for fast aggregate stats
- **Batch snapshot inserts**: Simulation inserts snapshots in batches of 500
- **Snapshot cleanup**: Old snapshots (>2 hours) auto-cleaned every 5 minutes, preserving latest per miner
- **60s simulation interval**: Reduced from 30s to manage write pressure with 22K+ miners

## Running
- `npm run dev` starts the Express server (port 5000) + Vite dev server
- Database schema auto-pushed on startup via `drizzle-kit push`
- Seed data inserted on first run
- Simulation runs for demo miners, real poller runs for scanned miners

## Design Decisions
- Dark-first theme with amber/orange accent (mining industry feel)
- Font: Inter for UI, JetBrains Mono for monospace/data
- Sidebar navigation with fleet status summary
- 60-second polling interval for simulation, 30s for real miner snapshots
- Miners have `source` field: "simulation" (demo), "manual" (user-added), "scanned" (discovered by network scan)
- Network scanner uses TCP connections to CGMiner API (port 4028) with 3s timeout, 20 concurrent probes
- Max scan range: 1024 IPs per scan config
- Site layout: 47 air-cooled RK containers (C188-C284), each with ~486 M60/M60S miners, 14 racks x 40 slots per container (4 columns × 10 rows per rack)
- Rack grid: 4 miners wide × 10 rows tall = 40 physical positions; not all positions have miners (empty shown as grey)
- IP pattern: 4 sequential /24 subnets per container starting at 10.31.0.0
