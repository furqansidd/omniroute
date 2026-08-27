# Multi-Tenant Delivery Operations SaaS — Frontend Application

Clean, high-density field-operations web dashboard built with React 19, Vite, Tailwind CSS, shadcn/ui primitives, and Mapbox GL JS.

## Mapbox Token Setup

To enable real map interactions (Address Geocoding, Customer Pin-Drop, Zone Polygon Drawing, and Live Telemetry Trackboard):

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Obtain a free Mapbox public access token from [Mapbox Account Dashboard](https://account.mapbox.com/).
3. Set your token in `.env`:
   ```env
   VITE_MAPBOX_TOKEN=pk.eyJ1Ijo...
   ```
