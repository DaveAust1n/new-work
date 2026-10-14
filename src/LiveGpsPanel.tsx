import { useEffect, useState } from 'react'
import { MapPin, Radio, Smartphone } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type DeviceLocation = { device_id: string; latitude: number; longitude: number; accuracy_m: number | null; speed_mps: number | null; heading_deg: number | null; recorded_at: string }

export default function LiveGpsPanel() {
  const [location, setLocation] = useState<DeviceLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    let channel: RealtimeChannel | null = null
    const connect = async () => {
      const { data: userData } = await supabase!.auth.getUser()
      const user = userData.user
      if (!user || !active) { setLoading(false); return }
      const { data } = await supabase!.from('device_locations').select('device_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,recorded_at').eq('owner_id', user.id).order('recorded_at', { ascending: false }).limit(1)
      if (active && data?.[0]) setLocation(data[0] as DeviceLocation)
      if (active) setLoading(false)
      channel = supabase!.channel('waretrack-gps-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'device_locations', filter: 'owner_id=eq.' + user.id }, payload => {
        if (active && payload.new && 'latitude' in payload.new) setLocation(payload.new as DeviceLocation)
      }).subscribe(status => { if (active) setConnected(status === 'SUBSCRIBED') })
    }
    void connect()
    return () => { active = false; if (channel) void supabase!.removeChannel(channel) }
  }, [])

  const age = location ? Math.max(0, Math.round((Date.now() - new Date(location.recorded_at).getTime()) / 1000)) : null
  const fresh = age !== null && age < 30
  return <section className="panel gps-live-panel">
    <div className="panel-heading"><div><h2><Radio size={16} /> Phone GPS connection</h2><p>Live telemetry from your signed-in phone.</p></div><span className={'gps-live-badge ' + (fresh ? 'fresh' : '')}><i />{fresh ? 'GPS LIVE' : connected ? 'CONNECTED' : 'WAITING'}</span></div>
    {location ? <div className="gps-live-body">
      <div className="gps-live-device"><span><Smartphone size={18} /></span><div><strong>PHONE-01 · Truck GPS</strong><small>{fresh ? 'Updating from phone' : 'Last position received ' + age + 's ago'}</small></div></div>
      <div className="gps-live-coordinates"><div><small>LATITUDE</small><strong>{location.latitude.toFixed(6)}</strong></div><div><small>LONGITUDE</small><strong>{location.longitude.toFixed(6)}</strong></div><div><small>ACCURACY</small><strong>{location.accuracy_m == null ? '—' : '±' + Math.round(location.accuracy_m) + ' m'}</strong></div><div><small>SPEED</small><strong>{location.speed_mps == null ? '—' : (location.speed_mps * 3.6).toFixed(1) + ' km/h'}</strong></div></div>
      <a href={'https://www.google.com/maps?q=' + location.latitude + ',' + location.longitude} target="_blank" rel="noreferrer"><MapPin size={14} /> Open phone position in Maps</a>
    </div> : <div className="gps-live-empty"><Smartphone size={24} /><strong>{loading ? 'Checking for phone telemetry…' : 'No phone location received yet'}</strong><span>Sign in on the phone using this same account, then open /track and press Start GPS tracking.</span></div>}
  </section>
}
