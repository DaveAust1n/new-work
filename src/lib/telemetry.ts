/**
 * WareTrack device telemetry contract.
 *
 * The 3D scene should consume this normalized format regardless of whether
 * the source is a demo simulator, truck telematics API, or indoor RTLS gateway.
 * Never put provider secrets or device-ingestion credentials in the browser.
 */

export type TrackedDeviceKind = 'forklift' | 'truck'
export type TelemetrySource = 'simulator' | 'telematics_api' | 'indoor_rtls'
export type DeviceOperationalStatus = 'moving' | 'idle' | 'offline' | 'unknown'

export type DeviceTelemetry = {
  deviceId: string
  label: string
  kind: TrackedDeviceKind
  source: TelemetrySource
  observedAt: string
  status: DeviceOperationalStatus
  speedMps: number | null
  headingDegrees: number | null
  /** WGS84 coordinates, normally used for trucks outside the facility. */
  gps: { latitude: number; longitude: number } | null
  /** Warehouse-local coordinates, normally supplied by indoor positioning. */
  indoor: { facilityId: string; x: number; z: number; floor: string } | null
}

export type TelemetryListener = (devices: DeviceTelemetry[]) => void

export interface TelemetryProvider {
  /** Subscribe to normalized device snapshots. Returns an unsubscribe function. */
  subscribe(listener: TelemetryListener): () => void
  /** Start provider resources; safe to call once from an app lifecycle. */
  start(): void
  /** Release timers, sockets, and other provider resources. */
  stop(): void
}

const demoDevices: DeviceTelemetry[] = [
  {
    deviceId: 'FL-01',
    label: 'Forklift 01',
    kind: 'forklift',
    source: 'simulator',
    observedAt: new Date(0).toISOString(),
    status: 'moving',
    speedMps: 1.2,
    headingDegrees: 90,
    gps: null,
    indoor: { facilityId: 'DC-01', x: -4.1, z: -3.3, floor: 'ground' },
  },
  {
    deviceId: 'FL-02',
    label: 'Forklift 02',
    kind: 'forklift',
    source: 'simulator',
    observedAt: new Date(0).toISOString(),
    status: 'moving',
    speedMps: 0.9,
    headingDegrees: 180,
    gps: null,
    indoor: { facilityId: 'DC-01', x: -1.5, z: 3.1, floor: 'ground' },
  },
  {
    deviceId: 'TR-01',
    label: 'Delivery truck 01',
    kind: 'truck',
    source: 'simulator',
    observedAt: new Date(0).toISOString(),
    status: 'moving',
    speedMps: 8.3,
    headingDegrees: 90,
    gps: { latitude: 6.5244, longitude: 3.3792 },
    indoor: null,
  },
]

/**
 * Browser-safe demo provider. This deliberately generates mock telemetry;
 * it does not claim to read real vehicles or sensors.
 */
export function createMockTelemetryProvider(intervalMs = 2000): TelemetryProvider {
  let timer: ReturnType<typeof setInterval> | undefined
  let phase = 0
  const listeners = new Set<TelemetryListener>()
  let snapshot = demoDevices.map((device) => ({ ...device }))

  const emit = () => {
    snapshot = snapshot.map((device, index) => {
      const wave = phase + index * 1.7
      if (device.kind === 'forklift' && device.indoor) {
        return {
          ...device,
          observedAt: new Date().toISOString(),
          status: Math.sin(wave) > -0.92 ? 'moving' : 'idle',
          speedMps: Math.sin(wave) > -0.92 ? 0.7 + Math.abs(Math.cos(wave)) * 0.6 : 0,
          indoor: {
            ...device.indoor,
            x: Math.sin(wave * 0.4) * 4,
            z: Math.cos(wave * 0.55) * 3,
          },
        }
      }
      if (device.kind === 'truck' && device.gps) {
        return {
          ...device,
          observedAt: new Date().toISOString(),
          status: 'moving',
          speedMps: 6 + Math.abs(Math.sin(wave)) * 5,
          headingDegrees: ((Math.atan2(Math.cos(wave), Math.sin(wave)) * 180) / Math.PI + 360) % 360,
          gps: {
            latitude: 6.5244 + Math.sin(wave) * 0.002,
            longitude: 3.3792 + Math.cos(wave) * 0.002,
          },
        }
      }
      return device
    })
    const immutableSnapshot = snapshot.map((device) => ({ ...device }))
    listeners.forEach((listener) => listener(immutableSnapshot))
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      listener(snapshot.map((device) => ({ ...device })))
      return () => listeners.delete(listener)
    },
    start() {
      if (timer) return
      timer = setInterval(() => {
        phase += 0.22
        emit()
      }, intervalMs)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = undefined
    },
  }
}
