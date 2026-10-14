import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, OrbitControls, Text } from '@react-three/drei'
import { AlertCircle, ArrowRightLeft, CheckCircle2, Layers3, MapPin, Package, Plus, RefreshCw, Warehouse } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import * as THREE from 'three'
import { supabase } from './lib/supabase'
import './gps-live.css'
import './spatial-warehouse.css'

type WarehouseBlock = {
  id: string
  owner_id: string
  block_code: string
  zone: string
  x: number
  y: number
  z: number
  capacity_units: number
  occupied_units: number
  item_label: string | null
  updated_at: string
}
type Movement = {
  id: string
  item_label: string
  quantity: number
  movement_type: 'receive' | 'move' | 'dispatch'
  created_at: string
  from_block_id: string | null
  to_block_id: string | null
}
type BlockProps = { block: WarehouseBlock; selected: boolean; onSelect: () => void }

function SpatialBlock({ block, selected, onSelect }: BlockProps) {
  const fill = block.occupied_units === 0 ? '#334957' : block.occupied_units / block.capacity_units >= 0.85 ? '#e2a35c' : '#55d6be'
  const height = 0.18 + (block.occupied_units / block.capacity_units) * 1.35
  const x = (block.x - 1) * 3
  const z = (block.z - 1) * 3
  return <group position={[x, 0, z]} onClick={(event) => { event.stopPropagation(); onSelect() }}>
    <mesh position={[0, 0.08, 0]} receiveShadow>
      <boxGeometry args={[2.25, 0.16, 2.25]} />
      <meshStandardMaterial color={selected ? '#286e67' : '#1d303d'} emissive={selected ? '#1b6c60' : '#000000'} emissiveIntensity={selected ? 0.6 : 0.1} />
    </mesh>
    {block.occupied_units > 0 && <mesh castShadow position={[0, 0.18 + height / 2, 0]}>
      <boxGeometry args={[1.55, height, 1.55]} />
      <meshStandardMaterial color={fill} roughness={0.62} />
    </mesh>}
    <mesh position={[0, 0.19, 0]}>
      <boxGeometry args={[2.1, 0.025, 2.1]} />
      <meshBasicMaterial color={selected ? '#8df2df' : fill} />
    </mesh>
    <Text position={[0, block.occupied_units > 0 ? height + 0.42 : 0.52, 0]} fontSize={0.3} color="#eef7fa" anchorX="center" anchorY="middle">{block.block_code}</Text>
    <Text position={[0, 0.29, 0.88]} fontSize={0.2} color={fill} anchorX="center" anchorY="middle">{block.occupied_units}/{block.capacity_units}</Text>
  </group>
}

function SpatialScene({ blocks, selectedId, onSelect }: { blocks: WarehouseBlock[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <Canvas shadows camera={{ position: [9, 11, 12], fov: 38 }} dpr={[1, 1.6]}>
    <color attach="background" args={['#101a24']} />
    <fog attach="fog" args={['#101a24', 22, 45]} />
    <ambientLight intensity={1.5} />
    <directionalLight position={[7, 12, 8]} intensity={2.2} castShadow />
    <pointLight position={[-3, 5, -3]} intensity={24} color="#55d6be" distance={20} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
      <planeGeometry args={[13, 13]} />
      <meshStandardMaterial color="#172630" roughness={0.95} />
    </mesh>
    <Grid position={[0, -0.025, 0]} args={[13, 13]} cellSize={1} cellColor="#344955" sectionSize={3} sectionColor="#4b6472" fadeDistance={24} infiniteGrid={false} />
    {blocks.map((block) => <SpatialBlock key={block.id} block={block} selected={selectedId === block.id} onSelect={() => onSelect(block.id)} />)}
    <ContactShadows position={[0, -0.02, 0]} opacity={0.3} scale={20} blur={2} far={5} />
    <Environment preset="city" />
    <OrbitControls makeDefault minDistance={8} maxDistance={24} maxPolarAngle={Math.PI / 2.05} enableDamping dampingFactor={0.08} />
  </Canvas>
}

export default function App() {
  const [blocks, setBlocks] = useState<WarehouseBlock[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [itemLabel, setItemLabel] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [destinationId, setDestinationId] = useState('')
  const [mode, setMode] = useState<'receive' | 'move'>('receive')
  const [ownerId, setOwnerId] = useState<string | null>(null)

  const loadData = useCallback(async (uid: string) => {
    if (!supabase) return
    const [blockResult, movementResult] = await Promise.all([
      supabase.from('warehouse_blocks').select('*').eq('owner_id', uid).order('zone').order('x').order('z'),
      supabase.from('warehouse_movements').select('*').eq('owner_id', uid).order('created_at', { ascending: false }).limit(8),
    ])
    if (blockResult.error) throw blockResult.error
    if (movementResult.error) throw movementResult.error
    setBlocks((blockResult.data ?? []) as WarehouseBlock[])
    setMovements((movementResult.data ?? []) as Movement[])
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); setError('Supabase is not configured. Add the Vercel environment variables before using the warehouse.'); return }
    let active = true
    let channel: RealtimeChannel | null = null
    const start = async () => {
      const { data, error: authError } = await supabase!.auth.getUser()
      if (authError) throw authError
      if (!data.user) throw new Error('Sign in to load your warehouse.')
      if (!active) return
      setOwnerId(data.user.id)
      await loadData(data.user.id)
      if (!active) return
      channel = supabase!.channel('spatial-warehouse-' + data.user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_blocks', filter: 'owner_id=eq.' + data.user.id }, () => { void loadData(data.user.id) })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_movements', filter: 'owner_id=eq.' + data.user.id }, () => { void loadData(data.user.id) })
        .subscribe()
    }
    void start().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load warehouse data.'))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; if (channel) void supabase!.removeChannel(channel) }
  }, [loadData])

  const selected = blocks.find((block) => block.id === selectedId) ?? null
  const totalCapacity = blocks.reduce((sum, block) => sum + block.capacity_units, 0)
  const totalOccupied = blocks.reduce((sum, block) => sum + block.occupied_units, 0)
  const occupiedBlocks = blocks.filter((block) => block.occupied_units > 0).length
  const freeBlocks = blocks.filter((block) => block.occupied_units === 0).length
  const formatTime = (value: string) => new Date(value).toLocaleString()
  const codeFor = (id: string | null) => blocks.find((block) => block.id === id)?.block_code ?? 'Warehouse'

  const createLayout = async () => {
    if (!supabase || !ownerId) return
    setBusy(true); setError(''); setNotice('')
    try {
      const rows: Omit<WarehouseBlock, 'id' | 'created_at' | 'updated_at'>[] = []
      for (const [zoneIndex, zone] of ['A', 'B', 'C'].entries()) {
        for (let aisle = 1; aisle <= 3; aisle++) {
          rows.push({
            owner_id: ownerId,
            block_code: zone + '-' + String(aisle).padStart(2, '0'),
            zone,
            x: zoneIndex,
            y: 0,
            z: aisle - 1,
            capacity_units: 100,
            occupied_units: 0,
            item_label: null,
          } as Omit<WarehouseBlock, 'id' | 'created_at' | 'updated_at'>)
        }
      }
      const { error: insertError } = await supabase.from('warehouse_blocks').insert(rows)
      if (insertError) throw insertError
      await loadData(ownerId)
      setNotice('Warehouse grid created. All blocks start empty; receive your actual stock to begin.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create the warehouse grid.') }
    finally { setBusy(false) }
  }

  const submitStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !ownerId || !selected) return
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty <= 0) { setError('Enter a whole-number quantity greater than zero.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'receive') {
        const { error: rpcError } = await supabase.rpc('receive_warehouse_stock', { p_block_id: selected.id, p_item_label: itemLabel, p_quantity: qty })
        if (rpcError) throw rpcError
        setNotice('Received ' + qty + ' units of ' + itemLabel.trim() + ' into ' + selected.block_code + '.')
        setItemLabel('')
      } else {
        if (!destinationId) throw new Error('Choose a destination block.')
        const { error: rpcError } = await supabase.rpc('move_warehouse_stock', { p_from_block_id: selected.id, p_to_block_id: destinationId, p_quantity: qty })
        if (rpcError) throw rpcError
        setNotice('Moved ' + qty + ' units from ' + selected.block_code + ' to ' + codeFor(destinationId) + '.')
      }
      await loadData(ownerId)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The stock operation failed.') }
    finally { setBusy(false) }
  }

  const refresh = async () => {
    if (!ownerId) return
    setBusy(true); setError('')
    try { await loadData(ownerId); setNotice('Warehouse data refreshed.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Refresh failed.') }
    finally { setBusy(false) }
  }

  const availableDestinations = useMemo(() => blocks.filter((block) => block.id !== selected?.id && (block.occupied_units === 0 || block.item_label === selected?.item_label) && block.occupied_units < block.capacity_units), [blocks, selected])

  return <div className="spatial-app">
    <aside className="spatial-sidebar">
      <div className="spatial-brand"><span><Warehouse size={22} /></span><div><strong>WareTrack</strong><small>WAREHOUSE OS</small></div></div>
      <div className="spatial-side-label">WORKSPACE</div>
      <div className="spatial-nav active"><Layers3 size={17} /> Spatial warehouse</div>
      <div className="spatial-sidebar-note"><strong>Coordinate system</strong><p>Every storage block has a permanent zone and X/Y/Z coordinate. Stock only changes when an operator records a real action.</p></div>
      <div className="spatial-sidebar-bottom"><span className="spatial-status-dot" /> Connected to your workspace</div>
    </aside>
    <main className="spatial-main">
      <header className="spatial-topbar"><div><span>Warehouse</span><b>/</b><strong>Spatial inventory</strong></div><button onClick={refresh} disabled={busy}><RefreshCw size={15} /> Refresh data</button></header>
      <div className="spatial-content">
        <div className="spatial-heading"><div><div className="spatial-eyebrow"><span /> PERSISTENT WAREHOUSE DATA</div><h1>Spatial warehouse<span>.</span></h1><p>Manage actual stock by block coordinates. Changes are saved to your workspace.</p></div><div className="spatial-heading-chip"><MapPin size={16} /> X · Y · Z grid</div></div>
        {error && <div className="spatial-alert error"><AlertCircle size={17} /><span>{error}</span></div>}
        {notice && <div className="spatial-alert success"><CheckCircle2 size={17} /><span>{notice}</span></div>}
        <div className="spatial-stats">
          <div><small>STOCK UNITS</small><strong>{totalOccupied.toLocaleString()}</strong><span>Recorded in blocks</span></div>
          <div><small>BLOCK CAPACITY</small><strong>{totalCapacity.toLocaleString()}</strong><span>{blocks.length} configured blocks</span></div>
          <div><small>OCCUPIED BLOCKS</small><strong>{occupiedBlocks}</strong><span>Blocks with recorded stock</span></div>
          <div><small>EMPTY BLOCKS</small><strong>{freeBlocks}</strong><span>Available storage blocks</span></div>
        </div>
        <section className="spatial-map-card">
          <div className="spatial-card-header"><div><h2>Warehouse coordinate grid</h2><p>Select a block to inspect or update its stock.</p></div><span className="spatial-live-label"><i /> SAVED DATA</span></div>
          {loading ? <div className="spatial-empty">Loading your warehouse…</div> : blocks.length === 0 ? <div className="spatial-empty"><Warehouse size={34} /><strong>Your warehouse layout hasn't been created</strong><span>Create a 3×3 block grid. It starts empty—no sample stock or fabricated movement records.</span><button onClick={createLayout} disabled={busy}><Plus size={16} /> Create warehouse grid</button></div> : <>
            <div className="spatial-scene"><SpatialScene blocks={blocks} selectedId={selected?.id ?? null} onSelect={setSelectedId} /><div className="spatial-scene-caption">Click a block · Drag to rotate · Scroll to zoom</div></div>
            <div className="spatial-block-list">{blocks.map((block) => <button key={block.id} className={'spatial-block-chip ' + (selected?.id === block.id ? 'selected' : '')} onClick={() => setSelectedId(block.id)}><span>{block.block_code}</span><small>{block.occupied_units}/{block.capacity_units}</small></button>)}</div>
          </>}
        </section>
        {selected && <div className="spatial-detail-grid">
          <section className="spatial-panel">
            <div className="spatial-card-header"><div><h2>Block {selected.block_code}</h2><p>Zone {selected.zone} · Coordinate X:{selected.x} Y:{selected.y} Z:{selected.z}</p></div><span className={'spatial-fill-tag ' + (selected.occupied_units ? 'has-stock' : '')}>{selected.occupied_units ? 'STOCK PRESENT' : 'EMPTY BLOCK'}</span></div>
            <div className="spatial-capacity"><div><span>Capacity used</span><strong>{Math.round(selected.occupied_units / selected.capacity_units * 100)}%</strong></div><div className="spatial-progress"><span style={{ width: (selected.occupied_units / selected.capacity_units * 100) + '%' }} /></div><small>{selected.occupied_units} units stored · {selected.capacity_units - selected.occupied_units} units free</small></div>
            <div className="spatial-current-item"><Package size={18} /><div><small>ITEM / SKU IN THIS BLOCK</small><strong>{selected.item_label ?? 'No item recorded'}</strong></div></div>
            <div className="spatial-mode-tabs"><button className={mode === 'receive' ? 'active' : ''} onClick={() => setMode('receive')}><Plus size={15} /> Receive stock</button><button className={mode === 'move' ? 'active' : ''} onClick={() => setMode('move')} disabled={selected.occupied_units === 0}><ArrowRightLeft size={15} /> Move stock</button></div>
            <form className="spatial-stock-form" onSubmit={submitStock}>
              {mode === 'receive' ? <label>Item name or SKU<input required value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} placeholder="Enter actual product or SKU" /></label> : <label>Destination block<select required value={destinationId} onChange={(e) => setDestinationId(e.target.value)}><option value="">Choose destination</option>{availableDestinations.map((block) => <option key={block.id} value={block.id}>{block.block_code} · {block.capacity_units - block.occupied_units} units free</option>)}</select></label>}
              <label>Quantity<input required type="number" min="1" step="1" max={mode === 'receive' ? selected.capacity_units - selected.occupied_units : selected.occupied_units} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
              <button type="submit" disabled={busy || (mode === 'move' && availableDestinations.length === 0)}>{busy ? 'Saving…' : mode === 'receive' ? 'Save received stock' : 'Confirm stock movement'}</button>
            </form>
            <p className="spatial-footnote">Stock operations are validated and recorded in the database. A block cannot exceed its capacity or mix different item labels.</p>
          </section>
          <section className="spatial-panel">
            <div className="spatial-card-header"><div><h2>Movement ledger</h2><p>Latest saved stock operations across your warehouse.</p></div></div>
            {movements.length === 0 ? <div className="spatial-ledger-empty">No movements recorded yet. Receive stock to start the ledger.</div> : <div className="spatial-ledger">{movements.map((movement) => <div className="spatial-ledger-row" key={movement.id}><span className={'spatial-ledger-icon ' + movement.movement_type}>{movement.movement_type === 'move' ? <ArrowRightLeft size={16} /> : <Package size={16} />}</span><div><strong>{movement.item_label}</strong><span>{movement.movement_type === 'receive' ? 'Received into ' + codeFor(movement.to_block_id) : movement.movement_type === 'move' ? codeFor(movement.from_block_id) + ' → ' + codeFor(movement.to_block_id) : 'Dispatched from ' + codeFor(movement.from_block_id)}</span><small>{formatTime(movement.created_at)}</small></div><b>{movement.movement_type === 'receive' ? '+' : '−'}{movement.quantity}</b></div>)}</div>}
          </section>
        </div>}
        <footer className="spatial-footer">WareTrack · Warehouse coordinates and inventory are saved to your authenticated workspace.</footer>
      </div>
    </main>
  </div>
}
