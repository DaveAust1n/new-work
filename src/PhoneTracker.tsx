import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowLeft, Crosshair, MapPin, Navigation, Radio, ShieldCheck, Truck } from 'lucide-react'
import './phone-tracker.css'
import { supabase } from './lib/supabase'

type PositionSnapshot = {
  latitude: number
  longitude: number
  accuracy: number
  speed: number | null
  heading: number | null
  timestamp: number
}

export default function PhoneTracker() {
  const [tracking, setTracking] = useState(false)
  const [position, setPosition] = useState<PositionSnapshot | null>(null)
  const [error, setError] = useState('')
  const [permissionHint, setPermissionHint] = useState('Ready to request your phone GPS')
  const [updatedAt, setUpdatedAt] = useState('')
  const watchId = useRef<number | null>(null)
  const refreshId = useRef<ReturnType<typeof setInterval> | null>(null)
  const deviceId = useRef<string | null>(null)
  const [syncError, setSyncError] = useState('')

  const publishPosition = async (next: PositionSnapshot) => {
    if (!supabase) { setSyncError('Backend configuration is missing.'); return }
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const user = authData.user
      if (!user) { setSyncError('Sign in with the same WareTrack account used on the computer.'); return }
      if (!deviceId.current) {
        const { data: existing, error: lookupError } = await supabase.from('tracking_devices').select('id').eq('owner_id', user.id).eq('device_name', 'PHONE-01').maybeSingle()
        if (lookupError) throw lookupError
        if (existing) deviceId.current = existing.id
        else {
          const { data: created, error: createError } = await supabase.from('tracking_devices').insert({ owner_id: user.id, device_name: 'PHONE-01', device_type: 'phone' }).select('id').single()
          if (createError) throw createError
          deviceId.current = created.id
        }
      }
      const recordedAt = new Date(next.timestamp).toISOString()
      const { error: writeError } = await supabase.from('device_locations').upsert({ device_id: deviceId.current, owner_id: user.id, latitude: next.latitude, longitude: next.longitude, accuracy_m: next.accuracy, speed_mps: next.speed, heading_deg: next.heading, recorded_at: recordedAt })
      if (writeError) throw writeError
      const { error: seenError } = await supabase.from('tracking_devices').update({ last_seen_at: recordedAt }).eq('id', deviceId.current).eq('owner_id', user.id)
      if (seenError) throw seenError
      setSyncError('')
      setPermissionHint('GPS active · sending updates to dashboard')
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Could not sync GPS to the dashboard.')
    }
  }

  const stopTracking = () => {
    if (watchId.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    if (refreshId.current !== null) {
      clearInterval(refreshId.current)
      refreshId.current = null
    }
    setTracking(false)
    setPermissionHint(position ? 'Tracking paused on this phone' : 'Tracking stopped')
  }

  const startTracking = () => {
    setError('')
    if (!('geolocation' in navigator)) {
      setError('This browser does not support GPS location. Try Chrome or Safari on your phone.')
      return
    }
    if (!window.isSecureContext) {
      setError('GPS access requires a secure HTTPS page.')
      return
    }
    // Prevent duplicate watchers if Start is pressed again after a GPS error.
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    if (refreshId.current !== null) clearInterval(refreshId.current)
    setPermissionHint('Waiting for location permission…')
    const handlePosition = (result: GeolocationPosition) => {
      const next: PositionSnapshot = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
        speed: result.coords.speed,
        heading: result.coords.heading,
        timestamp: result.timestamp,
      }
      setPosition(next)
      void publishPosition(next)
      setUpdatedAt(new Date(result.timestamp).toLocaleTimeString())
      setPermissionHint('Phone GPS is active')
      setTracking(true)
      setError('')
    }
    const handleError = (geoError: GeolocationPositionError) => {
      const message = geoError.code === 1
        ? 'Location permission was denied. Allow location access in your browser settings, then try again.'
        : geoError.code === 2
          ? 'Your phone could not get a location fix. Check Location Services and try outdoors.'
          : 'Location request timed out. Keep this page open and try again with a clearer GPS signal.'
      setError(message)
      setPermissionHint('GPS update failed — retrying while tracking is open')
      // Keep the watcher alive: the browser may recover when GPS signal improves.
    }
    watchId.current = navigator.geolocation.watchPosition(
      handlePosition,
      (result) => {
        const next: PositionSnapshot = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          speed: result.coords.speed,
          heading: result.coords.heading,
          timestamp: result.timestamp,
        }
        setPosition(next)
        void publishPosition(next)
        setUpdatedAt(new Date(result.timestamp).toLocaleTimeString())
        setPermissionHint('Phone GPS is active')
        setTracking(true)
      },
      handleError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 },
    )
    // Some mobile browsers stop delivering watchPosition callbacks. Ask for a fresh
    // one-shot fix periodically as a fallback, with caching disabled.
    refreshId.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      navigator.geolocation.getCurrentPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      })
    }, 7000)
    setTracking(true)
  }

  useEffect(() => () => {
    if (watchId.current !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId.current)
    if (refreshId.current !== null) clearInterval(refreshId.current)
  }, [])

  const speedKmh = position?.speed == null ? null : position.speed * 3.6

  return <main className="phone-track-page">
    <header className="phone-track-header">
      <a className="phone-track-back" href="/" aria-label="Back to WareTrack dashboard"><ArrowLeft size={17} /></a>
      <div className="phone-track-brand"><div className="phone-track-logo"><Truck size={20} /></div><div><strong>WareTrack</strong><span>DEVICE CONNECT</span></div></div>
      <span className={'phone-track-state ' + (tracking ? 'is-live' : '')}><i />{tracking ? 'GPS LIVE' : 'NOT TRACKING'}</span>
    </header>

    <section className="phone-track-content">
      <div className="phone-track-kicker"><Radio size={14} /> MOBILE TELEMETRY PROTOTYPE</div>
      <h1>Connect this phone</h1>
      <p className="phone-track-intro">Use your phone as a temporary GPS source for a WareTrack truck. Keep this page open while testing.</p>

      <div className="phone-track-device">
        <div className="phone-track-device-icon"><Truck size={24} /></div>
        <div className="phone-track-device-copy"><span>TEST DEVICE</span><strong>Truck GPS · PHONE-01</strong><small>Browser location · High accuracy requested</small></div>
        <span className="phone-track-source">GPS</span>
      </div>

      <div className="phone-track-map">
        <div className="phone-track-map-grid" />
        <div className={'phone-track-radar ' + (tracking && position ? 'radar-active' : '')}><Crosshair size={31} /></div>
        <div className="phone-track-map-caption"><MapPin size={14} />{position ? 'Current phone position captured' : 'Waiting for GPS signal'}</div>
      </div>

      <div className="phone-track-actions">
        {!tracking
          ? <button className="phone-track-start" onClick={startTracking}><Navigation size={17} /> Start GPS tracking</button>
          : <button className="phone-track-stop" onClick={stopTracking}>Pause tracking</button>}
        <p>Location is read only after you press Start and grant permission.</p>
      </div>

      {error && <div className="phone-track-error" role="alert">{error}</div>}
      {syncError && <div className="phone-track-error" role="alert">Dashboard sync: {syncError}</div>}

      <div className="phone-track-metrics">
        <div><span>LATITUDE</span><strong>{position ? position.latitude.toFixed(6) : '—'}</strong></div>
        <div><span>LONGITUDE</span><strong>{position ? position.longitude.toFixed(6) : '—'}</strong></div>
        <div><span>GPS ACCURACY</span><strong>{position ? '±' + Math.round(position.accuracy) + ' m' : '—'}</strong></div>
        <div><span>SPEED</span><strong>{speedKmh == null ? '—' : speedKmh.toFixed(1) + ' km/h'}</strong></div>
      </div>

      <div className="phone-track-status"><Activity size={16} /><div><strong>{permissionHint}</strong><span>{updatedAt ? 'Last GPS update: ' + updatedAt : 'No location updates received yet'}</span></div></div>
      <div className="phone-track-privacy"><ShieldCheck size={16} /><p><strong>Privacy note</strong> When tracking is active, coordinates are sent to your private WareTrack workspace. Sign in with the same account on your computer. Keep this page open during testing and stop tracking when finished.</p></div>
    </section>
    <footer className="phone-track-footer">WARETRACK · REAL-WORLD DEVICE TESTING</footer>
  </main>
}
