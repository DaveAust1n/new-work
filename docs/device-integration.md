# WareTrack real-world device integration

## Target architecture

Physical device/provider -> authenticated ingestion endpoint or gateway -> normalized telemetry -> database/event stream -> React Three Fiber scene.

The 3D app must never talk directly to a vehicle controller or hold a provider secret. Start with monitoring only; do not send motion/control commands to real forklifts.

## Normalized telemetry contract

`src/lib/telemetry.ts` defines `DeviceTelemetry` and `TelemetryProvider`. The scene should depend on this contract, not on any one hardware vendor. Sources currently represented are:

- `simulator`: local mock data for development.
- `telematics_api`: truck GPS/telematics provider.
- `indoor_rtls`: indoor real-time location system (e.g. UWB-based tracking gateway).

Truck records can carry WGS84 GPS coordinates. Forklift records should use warehouse-local coordinates from indoor positioning; GPS generally isn't reliable enough inside buildings. Map provider coordinates into the facility's 3D coordinate system before rendering.

## Build in this order

1. **Now, with no hardware:** wire the mock provider into the UI and verify device IDs, freshness, offline state, and coordinate mapping.
2. **Backend:** create a dedicated WareTrack Supabase project (do not reuse an unrelated project by accident). Add authenticated users, facilities, tracked devices, telemetry events/positions, and row-level security.
3. **Ingestion:** add a server-side endpoint for a chosen provider/webhook. Verify signatures, validate payloads, reject stale/out-of-range positions, and never expose service-role credentials in Vite/browser variables.
4. **Trucks:** use a provider's documented API/webhooks or a compatible GPS tracker. Normalize timestamps, latitude/longitude, speed and heading.
5. **Forklifts:** pilot an indoor RTLS vendor/gateway that outputs device ID + x/y position. Define the facility origin, axes, scale and floor map calibration.
6. **Live UI:** broadcast accepted position updates to the browser (e.g. Supabase Realtime or a WebSocket/MQTT bridge). Interpolate positions smoothly and mark devices stale/offline if updates stop arriving.
7. **Pilot:** test one truck and one forklift with a warehouse operator before onboarding more devices.

## Minimum data rules

- Every event includes a stable device ID and the source timestamp.
- Store the time the server received the event as well as the device's observed time.
- Deduplicate retries and ignore older/out-of-order readings.
- Separate device position from business state: GPS does not prove a delivery was completed; confirm that through an order scan or a trusted delivery event.
- Use realistic update rates and retention; do not write every high-frequency GPS point to the database forever.
- Keep provider credentials on the server, validate incoming requests, and scope reads to the user's facility.

## Important limitation

The current warehouse motion is still a visual simulation. This contract and mock provider are development scaffolding only; no real vehicle or sensor is connected yet.
