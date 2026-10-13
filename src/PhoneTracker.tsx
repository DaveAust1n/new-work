import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowLeft, Crosshair, MapPin, Navigation, Radio, ShieldCheck, Truck } from 'lucide-react'
import './phone-tracker.css'

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

  const stopTracking = () => {
    if (watchId.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
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
    setPermissionHint('Waiting for location permission…')
    watchId.current = navigator.geolocation.watchPosition(
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
        setUpdatedAt(new Date(result.timestamp).toLocaleTimeString())
        setPermissionHint('Phone GPS is active')
        setTracking(true)
      },
      (geoError) => {
        const message = geoError.code === 1
          ? 'Location permission was denied. Allow location access in your browser settings, then try again.'
          : geoError.code === 2
            ? 'Your phone could not get a location fix. Check Location Services and try outdoors.'
            : 'Location request timed out. Try again with a clearer GPS signal.'
        setError(message)
        setTracking(false)
        setPermissionHint('GPS is not connected')
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
    setTracking(true)
  }

  useEffect(() => () => {
    if (watchId.current !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId.current)
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

      <div className="phone-track-metrics">
        <div><span>LATITUDE</span><strong>{position ? position.latitude.toFixed(6) : '—'}</strong></div>
        <div><span>LONGITUDE</span><strong>{position ? position.longitude.toFixed(6) : '—'}</strong></div>
        <div><span>GPS ACCURACY</span><strong>{position ? '±' + Math.round(position.accuracy) + ' m' : '—'}</strong></div>
        <div><span>SPEED</span><strong>{speedKmh == null ? '—' : speedKmh.toFixed(1) + ' km/h'}</strong></div>
      </div>

      <div className="phone-track-status"><Activity size={16} /><div><strong>{permissionHint}</strong><span>{updatedAt ? 'Last GPS update: ' + updatedAt : 'No location updates received yet'}</span></div></div>
      <div className="phone-track-privacy"><ShieldCheck size={16} /><p><strong>Privacy note</strong> This prototype displays location on this phone only. It does not send coordinates to the WareTrack dashboard yet. Keep the page open during testing and stop tracking when finished.</p></div>
    </section>
    <footer className="phone-track-footer">WARETRACK · REAL-WORLD DEVICE TESTING</footer>
  </main>
}
