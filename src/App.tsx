import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, OrbitControls, Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import LiveGpsPanel from './LiveGpsPanel'
import { supabase } from './lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import './gps-live.css'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Box, CalendarDays,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Command, Ellipsis, Pause, Play, RotateCcw,
  Forklift, LayoutDashboard, MapPin, Maximize2, Package, PackageCheck, Plus, Search,
  Settings2, ShieldCheck, Truck, Warehouse, Zap
} from 'lucide-react'

type RackData = { id: string; zone: string; x: number; z: number; occupied: number; capacity: number; status: 'Healthy' | 'Low stock' | 'Attention' }
type LiveGpsPosition = { device_id: string; latitude: number; longitude: number; accuracy_m: number | null; speed_mps: number | null; heading_deg: number | null; recorded_at: string }
const initialRacks: RackData[] = [
  { id: 'A-01', zone: 'A', x: -5.2, z: -2.2, occupied: 82, capacity: 100, status: 'Healthy' },
  { id: 'A-02', zone: 'A', x: -5.2, z: 0, occupied: 64, capacity: 100, status: 'Healthy' },
  { id: 'A-03', zone: 'A', x: -5.2, z: 2.2, occupied: 28, capacity: 100, status: 'Low stock' },
  { id: 'B-01', zone: 'B', x: -1.8, z: -2.2, occupied: 91, capacity: 100, status: 'Attention' },
  { id: 'B-02', zone: 'B', x: -1.8, z: 0, occupied: 73, capacity: 100, status: 'Healthy' },
  { id: 'B-03', zone: 'B', x: -1.8, z: 2.2, occupied: 56, capacity: 100, status: 'Healthy' },
  { id: 'C-01', zone: 'C', x: 1.6, z: -2.2, occupied: 49, capacity: 100, status: 'Healthy' },
  { id: 'C-02', zone: 'C', x: 1.6, z: 0, occupied: 87, capacity: 100, status: 'Healthy' },
  { id: 'C-03', zone: 'C', x: 1.6, z: 2.2, occupied: 18, capacity: 100, status: 'Low stock' },
]
const shipments = [
  { id: 'SHP-2084', company: 'Northstar Retail', items: 18, eta: '09:42 AM', status: 'Loading', color: '#f7b84b' },
  { id: 'SHP-2085', company: 'Atlas Distribution', items: 42, eta: '10:15 AM', status: 'In transit', color: '#55d6be' },
  { id: 'SHP-2086', company: 'Urban Supply Co.', items: 12, eta: '10:30 AM', status: 'Queued', color: '#9b8cff' },
]
const activity = [
  { title: 'Inbound shipment received', detail: 'SHP-2083 · Dock 02', time: '2 min ago', icon: PackageCheck, tone: 'mint' },
  { title: 'Stock threshold reached', detail: 'Rack A-03 · Zone A', time: '8 min ago', icon: AlertTriangle, tone: 'amber' },
  { title: 'Forklift FL-04 assigned', detail: 'Move pallet to Zone C', time: '14 min ago', icon: Forklift, tone: 'blue' },
]

function Pallet({ x, y, z, color = '#d69b62' }: { x: number; y: number; z: number; color?: string }) {
  return <group position={[x, y, z]}>
    <mesh castShadow position={[0, 0.09, 0]}><boxGeometry args={[0.58, 0.18, 0.52]} /><meshStandardMaterial color="#8d6545" roughness={0.8} /></mesh>
    {[0, 1, 2].map((n) => <mesh key={n} castShadow position={[0, 0.34 + n * 0.19, 0]}><boxGeometry args={[0.48, 0.17, 0.42]} /><meshStandardMaterial color={color} roughness={0.68} /></mesh>)}
    <mesh position={[0, 0.34, 0.217]}><boxGeometry args={[0.24, 0.12, 0.009]} /><meshStandardMaterial color="#f4d9a7" /></mesh>
  </group>
}

function Rack({ rack, selected, onSelect }: { rack: RackData; selected: boolean; onSelect: () => void }) {
  const frame = rack.status === 'Attention' ? '#ed8a59' : '#73889a'
  const boxColor = rack.status === 'Low stock' ? '#d9ad62' : rack.status === 'Attention' ? '#e27c59' : '#7f9eac'
  return <group position={[rack.x, 0, rack.z]} onClick={(e) => { e.stopPropagation(); onSelect() }}>
    <mesh position={[0, 1.02, 0]}><boxGeometry args={[1.18, 0.035, 0.76]} /><meshStandardMaterial color={selected ? '#5ee0c1' : '#304352'} emissive={selected ? '#1a9e84' : '#000000'} emissiveIntensity={selected ? 0.6 : 0} /></mesh>
    {[-0.55, 0.55].map((x) => [-0.34, 0.34].map((z) => <mesh key={x + ':' + z} castShadow position={[x, 0.95, z]}><boxGeometry args={[0.055, 1.9, 0.055]} /><meshStandardMaterial color={frame} metalness={0.55} roughness={0.38} /></mesh>))}
    {[0.32, 0.91, 1.48].map((y) => <group key={y}>
      <mesh position={[0, y, 0]}><boxGeometry args={[1.15, 0.045, 0.72]} /><meshStandardMaterial color="#4c6475" metalness={0.3} /></mesh>
      <Pallet x={-0.27} y={y + 0.03} z={0} color={boxColor} />
      {rack.occupied > 60 && <Pallet x={0.27} y={y + 0.03} z={0} color={boxColor} />}
    </group>)}
    <mesh position={[0, 2.08, 0]}><boxGeometry args={[0.8, 0.22, 0.08]} /><meshStandardMaterial color={selected ? '#5ee0c1' : '#223544'} /></mesh>
    <Text position={[0, 2.08, 0.052]} fontSize={0.12} color={selected ? '#06231f' : '#dce8ef'} anchorX="center" anchorY="middle">{rack.id}</Text>
    {selected && <mesh position={[0, 1.99, 0]}><boxGeometry args={[1.3, 2.22, 0.9]} /><meshBasicMaterial color="#55d6be" transparent opacity={0.08} depthWrite={false} /></mesh>}
  </group>
}

function ForkliftModel({ offset, speed, running, color = '#efb84e' }: { offset: number; speed: number; running: boolean; color?: string }) {
  const ref = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const route = useMemo(() => [[-4.1, -3.3], [-4.1, 3.1], [-2.9, 3.1], [-0.8, 3.1], [0.4, 3.1], [0.4, -3.2], [2.9, -3.2], [3.7, -1.4], [3.7, 2.7], [2.6, 3.4], [-1.2, 3.4], [-4.1, 1.4]], [])
  useFrame((_, delta) => {
    if (!ref.current || !running) return
    elapsed.current += delta * speed
    const phase = (elapsed.current * 0.62 + offset) % route.length
    const index = Math.floor(phase)
    const blend = phase - index
    const a = route[index]
    const b = route[(index + 1) % route.length]
    ref.current.position.set(a[0] + (b[0] - a[0]) * blend, 0, a[1] + (b[1] - a[1]) * blend)
    ref.current.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1])
  })
  return <group ref={ref} position={[-4.1, 0, -3.3]}>
    <mesh castShadow position={[0, 0.32, 0]}><boxGeometry args={[0.74, 0.42, 0.44]} /><meshStandardMaterial color={color} metalness={0.12} roughness={0.5} /></mesh>
    <mesh castShadow position={[-0.02, 0.67, -0.05]}><boxGeometry args={[0.35, 0.38, 0.36]} /><meshStandardMaterial color={color === '#efb84e' ? '#f8ca6b' : color} /></mesh>
    <mesh position={[0, 0.69, -0.05]}><boxGeometry args={[0.24, 0.23, 0.03]} /><meshStandardMaterial color="#1b303a" metalness={0.4} roughness={0.2} /></mesh>
    {[-0.25, 0.25].map((x) => [-0.18, 0.18].map((z) => <mesh key={x + ':' + z} castShadow rotation={[Math.PI / 2, 0, 0]} position={[x, 0.16, z]}><cylinderGeometry args={[0.105, 0.105, 0.09, 12]} /><meshStandardMaterial color="#17242c" roughness={0.85} /></mesh>))}
    <mesh position={[0.45, 0.38, 0]}><boxGeometry args={[0.05, 0.68, 0.08]} /><meshStandardMaterial color="#a7bac4" metalness={0.7} /></mesh>
    <mesh position={[0.58, 0.12, 0]}><boxGeometry args={[0.38, 0.055, 0.08]} /><meshStandardMaterial color="#a7bac4" metalness={0.7} /></mesh>
    <mesh position={[0.57, 0.2, 0.14]}><boxGeometry args={[0.38, 0.05, 0.06]} /><meshStandardMaterial color="#a7bac4" metalness={0.7} /></mesh>
    <mesh castShadow position={[0.68, 0.29, 0]}><boxGeometry args={[0.32, 0.2, 0.3]} /><meshStandardMaterial color="#d59a60" /></mesh>
  </group>
}

function DeliveryTruck({ x, z, color, offset, speed, running }: { x: number; z: number; color: string; offset: number; speed: number; running: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  useFrame((_, delta) => {
    if (!ref.current || !running) return
    elapsed.current += delta * speed
    const phase = (elapsed.current * 0.55 + offset) % 10
    ref.current.position.x = x + (phase < 5 ? phase * 0.34 : (10 - phase) * 0.34)
    ref.current.position.z = z + (phase < 5 ? 0.5 : -0.5)
    ref.current.rotation.y = phase < 5 ? Math.PI / 2 : -Math.PI / 2
  })
  return <group ref={ref} position={[x, 0, z]}>
    <mesh castShadow position={[0, 0.35, 0]}><boxGeometry args={[1.45, 0.55, 0.58]} /><meshStandardMaterial color={color} roughness={0.55} /></mesh>
    <mesh castShadow position={[0.55, 0.55, 0]}><boxGeometry args={[0.42, 0.45, 0.56]} /><meshStandardMaterial color="#a8d2dc" metalness={0.12} roughness={0.3} /></mesh>
    {[-0.43, 0.45].map((wx) => [-0.27, 0.27].map((wz) => <mesh key={wx + ':' + wz} rotation={[Math.PI / 2, 0, 0]} position={[wx, 0.16, wz]}><cylinderGeometry args={[0.12, 0.12, 0.09, 12]} /><meshStandardMaterial color="#17242c" /></mesh>))}
  </group>
}

/** A scene marker driven by the latest real phone GPS fix. Its first fix is the local anchor. */
function LiveGpsTruck({ gps }: { gps: LiveGpsPosition | null }) {
  const ref = useRef<THREE.Group>(null)
  const origin = useRef<{ latitude: number; longitude: number } | null>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (gps && !origin.current) origin.current = { latitude: gps.latitude, longitude: gps.longitude }

    let targetX = 5.1
    let targetZ = 0.2
    if (gps && origin.current) {
      const lat0 = origin.current.latitude
      const eastMeters = (gps.longitude - origin.current.longitude) * 111320 * Math.cos(lat0 * Math.PI / 180)
      const northMeters = (gps.latitude - origin.current.latitude) * 111320
      targetX += THREE.MathUtils.clamp(eastMeters * 0.14, -1.7, 1.7)
      targetZ += THREE.MathUtils.clamp(-northMeters * 0.14, -2.7, 2.7)
    }

    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, targetX, 4, delta)
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, targetZ, 4, delta)
    if (gps?.heading_deg != null) {
      const targetRotation = (90 - gps.heading_deg) * Math.PI / 180
      ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, targetRotation, 4, delta)
    }
  })

  const fresh = gps !== null && Date.now() - new Date(gps.recorded_at).getTime() < 30000
  return <group ref={ref} position={[5.1, 0, 0.2]}>
    <mesh castShadow position={[0, 0.35, 0]}><boxGeometry args={[1.45, 0.55, 0.58]} /><meshStandardMaterial color={fresh ? '#f7b84b' : '#657684'} roughness={0.55} /></mesh>
    <mesh castShadow position={[0.55, 0.55, 0]}><boxGeometry args={[0.42, 0.45, 0.56]} /><meshStandardMaterial color="#a8d2dc" metalness={0.12} roughness={0.3} /></mesh>
    {[-0.43, 0.45].map((wx) => [-0.27, 0.27].map((wz) => <mesh key={wx + ':' + wz} rotation={[Math.PI / 2, 0, 0]} position={[wx, 0.16, wz]}><cylinderGeometry args={[0.12, 0.12, 0.09, 12]} /><meshStandardMaterial color="#17242c" /></mesh>))}
    <Text position={[0, 0.95, 0]} fontSize={0.15} color={fresh ? '#f7d68d' : '#c1ccd3'} anchorX="center" anchorY="middle">{fresh ? 'LIVE GPS' : 'GPS WAITING'}</Text>
  </group>
}

function WarehouseScene({ racks, selectedRack, setSelectedRack, running, speed, liveGps }: { racks: RackData[]; selectedRack: string; setSelectedRack: (id: string) => void; running: boolean; speed: number; liveGps: LiveGpsPosition | null }) {
  const floorClick = (e: ThreeEvent<MouseEvent>) => { if (e.object.name === 'warehouse-floor') setSelectedRack('') }
  return <Canvas shadows camera={{ position: [10, 10, 12], fov: 36 }} dpr={[1, 1.6]} onPointerMissed={() => setSelectedRack('')}>
    <color attach="background" args={['#111b25']} />
    <fog attach="fog" args={['#111b25', 18, 38]} />
    <ambientLight intensity={1.4} />
    <directionalLight position={[8, 12, 6]} intensity={2.6} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
    <pointLight position={[-4, 6, -3]} intensity={45} color="#58d9c2" distance={18} />
    <group onClick={floorClick}>
      <mesh name="warehouse-floor" receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.07, 0]}><planeGeometry args={[18, 13]} /><meshStandardMaterial color="#1b2a36" roughness={0.92} /></mesh>
      <Grid position={[0, -0.055, 0]} args={[18, 13]} cellSize={0.8} cellThickness={0.5} cellColor="#334654" sectionSize={3.2} sectionThickness={0.8} sectionColor="#476171" fadeDistance={22} infiniteGrid={false} />
      {[-4.7, -1.3, 2.1].map((x, i) => <mesh key={x} position={[x, 0.005, 0]}><boxGeometry args={[0.08, 0.02, 7.7]} /><meshStandardMaterial color={['#56cdb5', '#e6b85c', '#7b8cf2'][i]} emissive={['#155a4e', '#624b18', '#303c7a'][i]} emissiveIntensity={0.3} /></mesh>)}
      {racks.map((rack) => <Rack key={rack.id} rack={rack} selected={selectedRack === rack.id} onSelect={() => setSelectedRack(rack.id)} />)}
      <LiveGpsTruck gps={liveGps} />
      <DeliveryTruck x={5.1} z={-2.5} color="#54bda8" offset={5} speed={speed} running={running} />
      <ForkliftModel offset={0} speed={speed} running={running} />
      <ForkliftModel offset={4.2} speed={speed * 0.82} running={running} color="#58b8d5" />
      <ForkliftModel offset={8.3} speed={speed * 0.68} running={running} color="#b18af4" />
      {[-4.7, -1.3, 2.1].map((x, i) => <Text key={x} position={[x, 0.12, 4.2]} fontSize={0.24} color={['#56cdb5', '#e6b85c', '#7b8cf2'][i]} anchorX="center">ZONE {['A', 'B', 'C'][i]}</Text>)}
      <mesh position={[5.15, 0.025, 0.2]}><boxGeometry args={[2.4, 0.035, 7.8]} /><meshStandardMaterial color="#243643" /></mesh>
      {[-2.7, -0.7, 1.3].map((z) => <mesh key={z} position={[5.15, 0.05, z]}><boxGeometry args={[2.3, 0.06, 1.4]} /><meshStandardMaterial color="#314958" /></mesh>)}
    </group>
    <ContactShadows position={[0, -0.04, 0]} opacity={0.3} scale={22} blur={2.2} far={4} />
    <Environment preset="city" />
    <OrbitControls makeDefault minDistance={8} maxDistance={24} maxPolarAngle={Math.PI / 2.05} minPolarAngle={0.35} enableDamping dampingFactor={0.08} />
  </Canvas>
}

function StatCard({ title, value, change, positive, icon: Icon, tint }: { title: string; value: string; change: string; positive: boolean; icon: typeof Box; tint: string }) {
  return <div className="stat-card">
    <div className="stat-top"><span>{title}</span><span className={'stat-icon ' + tint}><Icon size={17} /></span></div>
    <div className="stat-value">{value}</div>
    <div className={'stat-change ' + (positive ? 'positive' : 'negative')}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}<span className="muted"> vs last week</span></div>
  </div>
}

export default function App() {
  const [racks, setRacks] = useState(initialRacks)
  const [selectedRack, setSelectedRack] = useState('B-01')
  const [activeNav, setActiveNav] = useState('Overview')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showAlerts, setShowAlerts] = useState(false)
  const [simulationRunning, setSimulationRunning] = useState(true)
  const [simulationSpeed, setSimulationSpeed] = useState(1)
  const [events, setEvents] = useState(activity)
  const [liveGps, setLiveGps] = useState<LiveGpsPosition | null>(null)
  const selected = racks.find((rack) => rack.id === selectedRack)

  useEffect(() => {
    if (!supabase) return
    let active = true
    let channel: RealtimeChannel | null = null
    const connectGps = async () => {
      const { data: authData } = await supabase!.auth.getUser()
      const user = authData.user
      if (!user || !active) return
      const { data } = await supabase!.from('device_locations')
        .select('device_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,recorded_at')
        .eq('owner_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
      if (active && data?.[0]) setLiveGps(data[0] as LiveGpsPosition)
      channel = supabase!.channel('waretrack-scene-gps-' + user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'device_locations', filter: 'owner_id=eq.' + user.id }, (payload) => {
          if (active && payload.new && 'latitude' in payload.new) setLiveGps(payload.new as LiveGpsPosition)
        })
        .subscribe()
    }
    void connectGps()
    return () => { active = false; if (channel) void supabase!.removeChannel(channel) }
  }, [])
  useEffect(() => {
    if (!simulationRunning) return
    const timer = window.setInterval(() => {
      const updates = [
        { title: 'Forklift FL-02 moving pallet', detail: 'Zone A → outbound staging', time: 'Just now', icon: Forklift, tone: 'blue' },
        { title: 'Delivery truck approaching dock', detail: 'SHP-2085 · Bay 02', time: 'Just now', icon: Truck, tone: 'mint' },
        { title: 'Pallet picked for dispatch', detail: 'ORD-4021 · 4 units', time: 'Just now', icon: PackageCheck, tone: 'amber' },
        { title: 'Forklift FL-03 restocking', detail: 'Zone C · Rack C-02', time: 'Just now', icon: Package, tone: 'mint' },
      ]
      const next = updates[Math.floor(Math.random() * updates.length)]
      setEvents((prev) => [next, ...prev].slice(0, 4))
    }, 6500 / simulationSpeed)
    return () => window.clearInterval(timer)
  }, [simulationRunning, simulationSpeed])
  const visibleShipments = useMemo(() => shipments.filter((s) => (filter === 'All' || s.status === filter) && (s.id + s.company).toLowerCase().includes(search.toLowerCase())), [filter, search])
  const occupied = Math.round(racks.reduce((sum, rack) => sum + rack.occupied, 0) / racks.reduce((sum, rack) => sum + rack.capacity, 0) * 100)
  const receiveShipment = () => {
    const rack = racks.find((item) => item.id === 'A-03')!
    setRacks((prev) => prev.map((item) => item.id === 'A-03' ? { ...item, occupied: Math.min(100, item.occupied + 8), status: item.occupied + 8 >= 35 ? 'Healthy' : item.status } : item))
    setEvents((prev) => [{ title: 'Inbound stock received', detail: '8 units · Rack A-03', time: 'Just now', icon: PackageCheck, tone: 'mint' }, ...prev].slice(0, 4))
    setSelectedRack(rack.id)
  }
  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Inventory', icon: Package },
    { label: 'Shipments', icon: Truck },
    { label: 'Warehouse map', icon: Warehouse },
    { label: 'Analytics', icon: Activity },
  ]
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Warehouse size={21} /></div><div><b>waretrack</b><span>WAREHOUSE OS</span></div></div>
      <div className="workspace"><div className="workspace-avatar">N</div><div className="workspace-copy"><strong>Northstar Logistics</strong><span>Enterprise workspace</span></div><ChevronDown size={15} /></div>
      <div className="side-label">WORKSPACE</div>
      <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={'nav-item ' + (activeNav === label ? 'active' : '')} onClick={() => setActiveNav(label)}><Icon size={17} /><span>{label}</span>{label === 'Shipments' && <small>3</small>}</button>)}</nav>
      <div className="side-label tools-label">MANAGE</div>
      <nav>
        <button className="nav-item" onClick={() => setShowAlerts((v) => !v)}><Bell size={17} /><span>Alerts</span><small className="alert-count">2</small></button>
        <button className="nav-item" onClick={() => setActiveNav('Settings')}><Settings2 size={17} /><span>Settings</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><strong>Need a hand?</strong><p>Visit the operations guide for quick answers.</p><button onClick={() => setShowAlerts(true)}>Open help centre <ChevronRight size={13} /></button></div><div className="user-profile"><div className="user-avatar">DI</div><div><strong>David Igweonyia</strong><span>Operations manager</span></div><Ellipsis size={18} /></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div><div className="top-actions"><div className="system-status"><span className="live-dot" /> All systems operational</div><button className="icon-button" aria-label="Notifications" onClick={() => setShowAlerts((v) => !v)}><Bell size={18} /><i /></button><div className="top-avatar">DI</div></div></header>
      <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> WAREHOUSE SIMULATION · LIVE</div><h1>Warehouse in motion<span className="period">.</span></h1><p>Watch stock move, forklifts work, and deliveries flow through your facility.</p></div><div className="welcome-actions"><button className="button-secondary" onClick={() => setShowAlerts((v) => !v)}><CalendarDays size={16} /> Today <ChevronDown size={14} /></button><button className="button-primary" onClick={receiveShipment}><Plus size={17} /> Receive stock</button></div></div>
        {showAlerts && <div className="alert-banner"><AlertTriangle size={18} /><div><strong>2 items need attention</strong><span>Rack B-01 is near capacity · Rack A-03 is below target stock.</span></div><button onClick={() => { setShowAlerts(false); setSelectedRack('B-01') }}>Review alerts <ChevronRight size={14} /></button></div>}
        <LiveGpsPanel />
        <div className="stats-grid">
          <StatCard title="Total inventory" value="12,840" change="+8.2%" positive icon={Box} tint="mint-bg" />
          <StatCard title="Active shipments" value="36" change="+4.6%" positive icon={Truck} tint="blue-bg" />
          <StatCard title="Warehouse capacity" value={occupied + '%'} change="+2.1%" positive icon={Warehouse} tint="violet-bg" />
          <StatCard title="On-time dispatch" value="98.4%" change="−0.4%" positive={false} icon={Zap} tint="amber-bg" />
        </div>
        <div className="section-heading"><div><h2>Live warehouse floor</h2><p>The 3D world is the control room. Select racks, follow vehicles, and watch deliveries move.</p></div><div className="map-tools"><span className="live-pill"><span className="live-dot" /> {simulationRunning ? "LIVE SIMULATION" : "SIMULATION PAUSED"}</span><button className="square-button" onClick={() => setSimulationRunning((v) => !v)} title={simulationRunning ? "Pause simulation" : "Resume simulation"}>{simulationRunning ? <Pause size={16} /> : <Play size={16} />}</button><button className="square-button" onClick={() => { setSelectedRack(''); setSimulationSpeed(1) }} title="Reset view and speed"><RotateCcw size={16} /></button></div></div>
        <div className="warehouse-grid">
          <section className="warehouse-card"><div className="warehouse-card-head"><div><div className="card-title">Distribution centre <span className="tiny-badge">DC-01</span></div><div className="card-subtitle"><MapPin size={13} /> Lagos, Nigeria <span className="separator">·</span> 3 storage zones</div></div><button className="square-button" onClick={() => setSelectedRack('')} title="Reset selection"><Settings2 size={16} /></button></div><div className="scene-wrap"><WarehouseScene racks={racks} selectedRack={selectedRack} setSelectedRack={setSelectedRack} running={simulationRunning} speed={simulationSpeed} liveGps={liveGps} /><div className="scene-legend"><span><i className="legend-dot mint" /> Zone A</span><span><i className="legend-dot amber" /> Zone B</span><span><i className="legend-dot violet" /> Zone C</span><span className="legend-help"><Command size={12} /> Drag to rotate</span></div><div className="scene-corner">LIVE FACILITY VIEW <span>·</span> {simulationRunning ? "RUNNING" : "PAUSED"} <span>·</span> {simulationSpeed.toFixed(1)}×</div><div className="scene-control-strip"><span><i className="live-dot" /> {simulationRunning ? "Vehicles active" : "Vehicles paused"}</span><label>Simulation speed <select value={simulationSpeed} onChange={(e) => setSimulationSpeed(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label></div></div><div className="zone-summary">{[['A','Inbound & storage','74%','#56cdb5'],['B','Bulk inventory','86%','#e6b85c'],['C','Outbound staging','51%','#7b8cf2']].map(([zone, name, value, color]) => <div className="zone-item" key={zone}><div className="zone-head"><span className="zone-letter" style={{ color, borderColor: color }}>{zone}</span><span className="zone-name">{name}</span><strong>{value}</strong></div><div className="progress-track"><span style={{ width: value, background: color }} /></div></div>)}</div></section>
          <aside className="detail-card"><div className="detail-header"><div><span className="overline">SELECTED LOCATION</span><h3>{selected ? 'Rack ' + selected.id : 'Warehouse details'}</h3></div><button className="square-button"><Ellipsis size={17} /></button></div>{selected ? <><div className="rack-visual"><div className="rack-visual-icon"><Package size={26} /></div><div><strong>Storage rack {selected.id}</strong><span>Zone {selected.zone} · Aisle {selected.id.slice(-1)}</span></div><span className={'status-tag ' + (selected.status === 'Healthy' ? 'status-healthy' : selected.status === 'Attention' ? 'status-attention' : 'status-low')}>{selected.status}</span></div><div className="capacity-block"><div><span>Rack utilisation</span><strong>{selected.occupied}%</strong></div><div className="capacity-track"><span style={{ width: selected.occupied + '%', background: selected.status === 'Attention' ? '#ed8a59' : '#55d6be' }} /></div><div className="capacity-meta"><span>{Math.round(selected.occupied * 0.42)} pallet positions used</span><span>{100 - selected.occupied}% free</span></div></div><div className="detail-metrics"><div><span>SKUs stored</span><strong>{Math.round(selected.occupied * 1.7)}</strong></div><div><span>Available slots</span><strong>{100 - selected.occupied}</strong></div></div><div className="detail-divider" /><div className="mini-heading">RECENT MOVEMENTS <button onClick={() => setActiveNav('Inventory')}>View all <ChevronRight size={13} /></button></div><div className="movement"><span className="movement-icon inbound"><ArrowDownRight size={15} /></span><div><strong>Stock replenished</strong><span>SKU-{selected.id.replace('-', '')}-04</span></div><time>09:24</time></div><div className="movement"><span className="movement-icon outbound"><ArrowUpRight size={15} /></span><div><strong>Order picked</strong><span>ORD-4021 · 4 units</span></div><time>09:12</time></div><button className="button-outline full-button" onClick={receiveShipment}><Plus size={15} /> Receive stock at this rack</button></> : <div className="empty-detail"><Warehouse size={28} /><strong>Select a storage rack</strong><span>Click any rack in the 3D floor view to inspect its stock and movements.</span></div>}</aside>
        </div>
        <div className="lower-grid"><section className="panel"><div className="panel-heading"><div><h2>Shipment schedule</h2><p>Inbound and outbound activity for today.</p></div><button className="text-button" onClick={() => setActiveNav('Shipments')}>View all <ChevronRight size={14} /></button></div><div className="table-controls"><div className="search-box"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shipments..." /></div><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter shipments"><option>All</option><option>Loading</option><option>In transit</option><option>Queued</option></select></div><div className="shipment-list"><div className="shipment-table-head"><span>SHIPMENT</span><span>ITEMS</span><span>ETA</span><span>STATUS</span></div>{visibleShipments.map((s) => <div className="shipment-row" key={s.id}><div className="shipment-id"><span className="shipment-dot" style={{ background: s.color }} /><div><strong>{s.id}</strong><small>{s.company}</small></div></div><span>{s.items} items</span><span className="eta"><Clock3 size={13} />{s.eta}</span><span className={'shipment-status ' + s.status.toLowerCase().replace(' ', '-')}>{s.status}</span></div>)}{visibleShipments.length === 0 && <div className="no-results">No shipments match your search.</div>}</div></section><section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Live updates from your warehouse.</p></div><button className="square-button" onClick={() => setEvents(activity)} title="Reset activity"><Activity size={16} /></button></div><div className="activity-list">{events.map((event, i) => { const Icon = event.icon; return <div className="activity-row" key={event.title + i}><span className={'activity-icon ' + event.tone}><Icon size={15} /></span><div className="activity-copy"><strong>{event.title}</strong><span>{event.detail}</span></div><time>{event.time}</time></div> })}</div><div className="activity-footer"><span className="live-dot" /> {simulationRunning ? 'Live simulation events · updating automatically' : 'Simulation paused · events on hold'}</div></section></div>
        <footer className="footer"><span>© 2026 WareTrack Operations</span><span><ShieldCheck size={13} /> All systems operational</span><span>Built for the warehouse floor <span className="footer-heart">✦</span></span></footer>
      </div>
    </main>
    <button className="floating-help" onClick={() => setShowAlerts((v) => !v)} aria-label="Help"><CircleHelp size={19} /></button>
  </div>
}
