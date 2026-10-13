# WareTrack 3D — Warehouse Operations Demo

An original WareTrack-inspired warehouse operations interface built with React, TypeScript, Three.js and React Three Fiber.

## Features

- Interactive 3D warehouse scene with orbit/zoom controls
- Clickable storage racks with occupancy, SKU and available-slot details
- Animated forklift and loading-yard trucks
- Zone utilisation summaries
- Searchable and filterable shipment schedule
- Receive-stock interaction that updates a rack and activity feed
- Responsive desktop, tablet and mobile layouts

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Demo data

This first release uses local demo state only. Shipment activity, inventory figures and movement events are simulated in the browser; they are not connected to a warehouse management system or a live database yet.

## Stack

- Vite + React + TypeScript
- Three.js + React Three Fiber + Drei
- Lucide React icons
