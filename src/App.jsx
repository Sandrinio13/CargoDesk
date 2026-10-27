import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleHelp,
  Droplets,
  ExternalLink,
  FileText,
  FileUp,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { calculateExcisePenalty } from './calculator.js'
import {
  filterReservoirsByNumber,
  normalizeReservoirRecord,
  normalizeReservoirRecords,
} from './reservoirs.js'
const sanctionsPageSize = 25

const emptyDeclaration = {
  declarationNumber: '',
  declarationDate: '',
  exporter: '',
  importer: '',
  declarant: '',
  dispatchCountry: '',
  goodsDescription: '',
  commodityCode: '',
  grossKg: '',
  warehouseName: '',
  sourceFilename: '',
}

const fields = [
  { key: 'declarationNumber', label: 'C ნომერი', hint: 'გრაფა A', placeholder: 'მაგ. C123456' },
  { key: 'declarationDate', label: 'თარიღი', hint: 'გრაფა A', placeholder: 'დღე.თვე.წელი' },
  { key: 'exporter', label: 'ექსპორტიორი', hint: 'გრაფა 2 · EX', placeholder: 'ექსპორტიორის დასახელება' },
  { key: 'importer', label: 'იმპორტიორი', hint: 'გრაფა 2 · IM', placeholder: 'იმპორტიორის დასახელება' },
  { key: 'declarant', label: 'დეკლარანტი', hint: 'გრაფა 4', placeholder: 'დეკლარანტის სახელი' },
  { key: 'dispatchCountry', label: 'გამომგზავნი ქვეყანა', hint: 'გრაფა 15', placeholder: 'ქვეყანა' },
  { key: 'goodsDescription', label: 'საქონელი', hint: 'გრაფა 31', placeholder: 'საქონლის აღწერა' },
  { key: 'commodityCode', label: 'საქონლის კოდი', hint: 'გრაფა 33', placeholder: 'სასაქონლო კოდი' },
  { key: 'grossKg', label: 'ბრუტო, კგ', hint: 'გრაფა 35', placeholder: '0.00' },
  { key: 'warehouseName', label: 'საწყობი', hint: 'გრაფა 49', placeholder: 'საწყობის დასახელება' },
]

async function readResponse(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'მოთხოვნა ვერ შესრულდა.')
  return result
}

function App() {
  const [activePage, setActivePage] = useState('declarations')
  const [declarations, setDeclarations] = useState([])
  const [calculatorInput, setCalculatorInput] = useState({
    quantityKg: '',
    customsValue: '',
    exciseRatePerTonne: '',
  })
  const [query, setQuery] = useState('')
  const [sanctionsQuery, setSanctionsQuery] = useState('')
  const [sanctionsFilter, setSanctionsFilter] = useState('')
  const [sanctionsPage, setSanctionsPage] = useState(1)
  const [expandedSanction, setExpandedSanction] = useState(null)
  const [sanctionsData, setSanctionsData] = useState(null)
  const [sanctionsLoading, setSanctionsLoading] = useState(false)
  const [sanctionsError, setSanctionsError] = useState('')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reservoirs, setReservoirs] = useState([])
  const [reservoirsLoading, setReservoirsLoading] = useState(false)
  const [reservoirsLoaded, setReservoirsLoaded] = useState(false)
  const [reservoirsError, setReservoirsError] = useState('')
  const [reservoirSearch, setReservoirSearch] = useState('')
  const [reservoirModalOpen, setReservoirModalOpen] = useState(false)
  const [reservoirNumber, setReservoirNumber] = useState('')
  const [reservoirCapacity, setReservoirCapacity] = useState('')
  const [reservoirFormError, setReservoirFormError] = useState('')
  const [reservoirSaving, setReservoirSaving] = useState(false)
  const [reservoirDeleting, setReservoirDeleting] = useState(false)
  const [reservoirDeleteModalOpen, setReservoirDeleteModalOpen] = useState(false)
  const [reservoirDeleteError, setReservoirDeleteError] = useState('')
  const [selectedReservoirId, setSelectedReservoirId] = useState(null)
  const [receiveWeightInput, setReceiveWeightInput] = useState('')
  const [releaseWeightInput, setReleaseWeightInput] = useState('')
  const [reservoirMovementSaving, setReservoirMovementSaving] = useState('')
  const [receiveWeightError, setReceiveWeightError] = useState('')
  const [releaseWeightError, setReleaseWeightError] = useState('')
  const fileInput = useRef(null)

  async function loadReservoirs() {
    setReservoirsLoading(true)
    setReservoirsError('')
    try {
      const loadedReservoirs = normalizeReservoirRecords(
        await readResponse(await fetch('/api/reservoirs')),
      )
      setReservoirs(loadedReservoirs)
      const selected = loadedReservoirs.find(
        (reservoir) => String(reservoir.id) === String(selectedReservoirId),
      ) ?? loadedReservoirs[0]
      setSelectedReservoirId(selected?.id ?? null)
      setReceiveWeightInput('')
      setReleaseWeightInput('')
      setReservoirsLoaded(true)
    } catch (loadError) {
      setReservoirsError(loadError.message)
    } finally {
      setReservoirsLoading(false)
    }
  }

  async function loadDeclarations() {
    setLoading(true)
    setError('')
    try {
      setDeclarations(await readResponse(await fetch('/api/declarations')))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadSanctions() {
    setActivePage('sanctions')
    if (sanctionsData || sanctionsLoading) return
    setSanctionsLoading(true)
    setSanctionsError('')
    try {
      const module = await import('./sanctions.json')
      setSanctionsData(module.default)
    } catch (loadError) {
      setSanctionsError(
        loadError instanceof Error ? loadError.message : 'მონაცემების ჩატვირთვა ვერ მოხერხდა.',
      )
    } finally {
      setSanctionsLoading(false)
    }
  }

  useEffect(() => {
    loadDeclarations()
  }, [])

  useEffect(() => {
    if (activePage === 'terminal' && !reservoirsLoaded && !reservoirsLoading) {
      loadReservoirs()
    }
  }, [activePage, reservoirsLoaded])

  const sanctionsFieldsByKey = useMemo(
    () => Object.fromEntries((sanctionsData?.fields ?? []).map((field) => [field.key, field])),
    [sanctionsData],
  )

  const filteredDeclarations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ka')
    if (!normalizedQuery) return declarations
    return declarations.filter((row) =>
      [
        row.declaration_number,
        row.declaration_date,
        row.exporter,
        row.importer,
        row.declarant,
        row.dispatch_country,
        row.goods_description,
        row.commodity_code,
        row.warehouse_name,
      ]
        .join(' ')
        .toLocaleLowerCase('ka')
        .includes(normalizedQuery),
    )
  }, [declarations, query])

  const filteredSanctions = useMemo(() => {
    if (!sanctionsData) return []
    const normalizedQuery = sanctionsQuery.trim().toLocaleLowerCase('ka')
    return sanctionsData.rows.filter((row) => {
      if (
        sanctionsFilter &&
        !row.restrictions.some((restriction) => restriction.key === sanctionsFilter)
      ) {
        return false
      }
      if (!normalizedQuery) return true
      return [row.code, row.description, ...row.restrictions.map(({ value }) => value)]
        .join(' ')
        .toLocaleLowerCase('ka')
        .includes(normalizedQuery)
    })
  }, [sanctionsData, sanctionsFilter, sanctionsQuery])

  const sanctionsPageCount = Math.max(1, Math.ceil(filteredSanctions.length / sanctionsPageSize))
  const visibleSanctions = filteredSanctions.slice(
    (sanctionsPage - 1) * sanctionsPageSize,
    sanctionsPage * sanctionsPageSize,
  )

  async function handleFile(file) {
    if (!file) return
    setError('')
    setNotice('')
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('აირჩიეთ PDF ფორმატის დოკუმენტი.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('PDF ფაილის მაქსიმალური ზომაა 20 მბ.')
      return
    }

    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const result = await readResponse(
        await fetch('/api/declarations/parse', { method: 'POST', body: form }),
      )
      setDraft({
        ...emptyDeclaration,
        ...result.fields,
        sourceFilename: result.sourceFilename,
        hasText: result.hasText,
        pageCount: result.pageCount,
      })
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function saveDeclaration(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await readResponse(
        await fetch('/api/declarations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        }),
      )
      setDeclarations((current) => [saved, ...current])
      setDraft(null)
      setNotice('დეკლარაცია წარმატებით შეინახა.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  const totalGross = declarations.reduce((sum, row) => sum + Number(row.gross_kg || 0), 0)
  const hasCalculatorError = Object.values(calculatorInput).some(
    (value) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0),
  )
  const hasCalculatorValues = Object.values(calculatorInput).every((value) => value !== '')
  const calculation = hasCalculatorValues && !hasCalculatorError
    ? calculateExcisePenalty({
        quantityKg: Number(calculatorInput.quantityKg),
        customsValue: Number(calculatorInput.customsValue),
        exciseRatePerTonne: Number(calculatorInput.exciseRatePerTonne),
      })
    : null
  const formatAmount = (amount) =>
    amount.toLocaleString('ka-GE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatWeight = (amount) =>
    amount.toLocaleString('ka-GE', { maximumFractionDigits: 3 })
  const formatCapacity = (amount) =>
    amount.toLocaleString('ka-GE', { maximumFractionDigits: 3 })
  const selectedReservoir = reservoirs.find(
    (reservoir) => String(reservoir.id) === String(selectedReservoirId),
  )
  const visibleReservoirs = filterReservoirsByNumber(reservoirs, reservoirSearch)
  const reservoirCapacityTotal = reservoirs.reduce(
    (total, reservoir) => total + reservoir.capacity_kg,
    0,
  )
  const reservoirWeightTotal = reservoirs.reduce(
    (total, reservoir) => total + reservoir.current_weight_kg,
    0,
  )
  const receiveWeight = Number(receiveWeightInput)
  const releaseWeight = Number(releaseWeightInput)
  const receiveWeightInvalid =
    receiveWeightInput === '' ||
    !Number.isFinite(receiveWeight) ||
    receiveWeight <= 0 ||
    (selectedReservoir &&
      receiveWeight > selectedReservoir.capacity_kg - selectedReservoir.current_weight_kg)
  const releaseWeightInvalid =
    releaseWeightInput === '' ||
    !Number.isFinite(releaseWeight) ||
    releaseWeight <= 0 ||
    (selectedReservoir && releaseWeight > selectedReservoir.current_weight_kg)
  const selectedReservoirPercent = selectedReservoir
    ? Math.min(
        100,
        Math.max(0, Math.round((selectedReservoir.current_weight_kg / selectedReservoir.capacity_kg) * 100)),
      )
    : 0

  function selectReservoir(reservoir) {
    setSelectedReservoirId(reservoir?.id ?? null)
    setReceiveWeightInput('')
    setReleaseWeightInput('')
    setReceiveWeightError('')
    setReleaseWeightError('')
    setReservoirDeleteError('')
  }

  function searchReservoirs(value) {
    setReservoirSearch(value)
    const matchingReservoirs = filterReservoirsByNumber(reservoirs, value)
    if (!matchingReservoirs.some(
      (reservoir) => String(reservoir.id) === String(selectedReservoirId),
    )) {
      selectReservoir(matchingReservoirs[0] ?? null)
    }
  }

  async function addReservoir(event) {
    event.preventDefault()
    setReservoirSaving(true)
    setReservoirFormError('')
    try {
      const created = await readResponse(await fetch('/api/reservoirs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservoirNumber,
          capacityKg: Number(reservoirCapacity),
        }),
      }))
      const newReservoir = normalizeReservoirRecord(created)
      setReservoirs((current) => [...current, newReservoir])
      selectReservoir(newReservoir)
      setReservoirNumber('')
      setReservoirCapacity('')
      setReservoirModalOpen(false)
    } catch (saveError) {
      setReservoirFormError(saveError.message)
    } finally {
      setReservoirSaving(false)
    }
  }

  async function moveReservoirWeight(event, direction) {
    event.preventDefault()
    const quantityKg = direction === 'receive' ? receiveWeight : releaseWeight
    const invalid = direction === 'receive' ? receiveWeightInvalid : releaseWeightInvalid
    if (!selectedReservoir || invalid) return

    setReservoirMovementSaving(direction)
    if (direction === 'receive') setReceiveWeightError('')
    else setReleaseWeightError('')
    try {
      const updated = await readResponse(await fetch(
        `/api/reservoirs/${encodeURIComponent(selectedReservoir.id)}/transactions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction, quantityKg }),
        },
      ))
      const updatedReservoir = normalizeReservoirRecord(updated)
      setReservoirs((current) =>
        current.map((reservoir) =>
          String(reservoir.id) === String(updatedReservoir.id) ? updatedReservoir : reservoir,
        ),
      )
      if (direction === 'receive') setReceiveWeightInput('')
      else setReleaseWeightInput('')
    } catch (saveError) {
      if (direction === 'receive') setReceiveWeightError(saveError.message)
      else setReleaseWeightError(saveError.message)
    } finally {
      setReservoirMovementSaving('')
    }
  }

  async function deleteReservoir() {
    if (!selectedReservoir || reservoirDeleting || reservoirMovementSaving) return

    setReservoirDeleting(true)
    setReservoirDeleteError('')
    try {
      await readResponse(await fetch(
        `/api/reservoirs/${encodeURIComponent(selectedReservoir.id)}`,
        { method: 'DELETE' },
      ))
      const remainingReservoirs = reservoirs.filter(
        (reservoir) => String(reservoir.id) !== String(selectedReservoir.id),
      )
      setReservoirs(remainingReservoirs)
      setSelectedReservoirId(remainingReservoirs[0]?.id ?? null)
      setReceiveWeightInput('')
      setReleaseWeightInput('')
      setReceiveWeightError('')
      setReleaseWeightError('')
      setReservoirDeleteModalOpen(false)
    } catch (deleteError) {
      setReservoirDeleteError(deleteError.message)
    } finally {
      setReservoirDeleting(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="CargoDesk მთავარი">
          <span className="brand__symbol"><Boxes size={20} strokeWidth={2.4} /></span>
          <span>Cargo<span className="brand__light">Desk</span></span>
        </a>
        <p className="sidebar__caption">სამუშაო სივრცე</p>
        <nav className="sidebar__nav" aria-label="მთავარი ნავიგაცია">
          <button
            className={`nav-link${activePage === 'declarations' ? ' nav-link--active' : ''}`}
            type="button"
            aria-current={activePage === 'declarations' ? 'page' : undefined}
            onClick={() => setActivePage('declarations')}
          >
            <LayoutDashboard size={18} />
            <span>დეკლარაციები</span>
            <span className="nav-link__count">{declarations.length}</span>
          </button>
          <button
            className={`nav-link${activePage === 'calculator' ? ' nav-link--active' : ''}`}
            type="button"
            aria-current={activePage === 'calculator' ? 'page' : undefined}
            onClick={() => setActivePage('calculator')}
          >
            <Calculator size={18} />
            <span>ჯარიმის კალკულატორი</span>
          </button>
          <button
            className={`nav-link${activePage === 'sanctions' ? ' nav-link--active' : ''}`}
            type="button"
            aria-current={activePage === 'sanctions' ? 'page' : undefined}
            onClick={loadSanctions}
          >
            <ShieldAlert size={18} />
            <span>სანქციები</span>
            {sanctionsData && <span className="nav-link__count">{sanctionsData.codedRecords.toLocaleString('ka-GE')}</span>}
          </button>
          <button
            className={`nav-link${activePage === 'terminal' ? ' nav-link--active' : ''}`}
            type="button"
            aria-current={activePage === 'terminal' ? 'page' : undefined}
            onClick={() => setActivePage('terminal')}
          >
            <Terminal size={18} />
            <span>ტერმინალი</span>
          </button>
        </nav>
        <div className="sidebar__bottom">
          <div className="sidebar__help">
            <span className="help-icon"><CircleHelp size={17} /></span>
            <div><strong>გჭირდებათ დახმარება?</strong><span>PDF-ის ატვირთვის გზამკვლევი</span></div>
          </div>
          <div className="profile">
            <div className="profile__avatar">CD</div>
            <div className="profile__text"><strong>სამუშაო სივრცე</strong><span>ადმინისტრატორი</span></div>
            <ChevronDown size={16} className="profile__chevron" />
          </div>
        </div>
      </aside>

      <main className="main-content" id="declarations">
        <header className="topbar">
          <div className="breadcrumbs"><span>სამუშაო სივრცე</span><span className="breadcrumbs__slash">/</span><strong>{activePage === 'declarations' ? 'დეკლარაციები' : activePage === 'calculator' ? 'ჯარიმის კალკულატორი' : activePage === 'terminal' ? 'ტერმინალი' : 'სანქციები'}</strong></div>
          <div className="topbar__right">
            <span className="secure-label"><ShieldCheck size={15} /> მონაცემები დაცულია</span>
            <div className="topbar__avatar">CD</div>
          </div>
        </header>

        {activePage === 'declarations' ? (
        <div className="page">
          <section className="page-heading">
            <div>
              <p className="eyebrow">საბაჟო დოკუმენტების მართვა</p>
              <h1>დეკლარაციები</h1>
              <p className="page-heading__description">ატვირთეთ PDF და მართეთ დეკლარაციებიდან ამოღებული მონაცემები ერთ სივრცეში.</p>
            </div>
            <button className="button button--primary" onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? <LoaderCircle size={17} className="spin" /> : <Plus size={18} />}
              ახალი დოკუმენტი
            </button>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </section>

          <section className="stats-grid" aria-label="სტატისტიკა">
            <article className="stat-card">
              <div className="stat-card__top"><span>დეკლარაციების რაოდენობა</span><span className="stat-card__icon stat-card__icon--blue"><FileText size={17} /></span></div>
              <div className="stat-card__value">{declarations.length}<span className="stat-card__unit">დოკუმენტი</span></div>
              <div className="stat-card__note">შენახული ჩანაწერები</div>
            </article>
            <article className="stat-card">
              <div className="stat-card__top"><span>ექსპორტიორი / იმპორტიორი</span><span className="stat-card__icon stat-card__icon--mint"><ArrowUpFromLine size={17} /></span></div>
              <div className="stat-card__value">{declarations.filter((row) => row.exporter || row.importer).length}<span className="stat-card__unit">დოკუმენტი</span></div>
              <div className="stat-card__note">მითითებული მხარეები</div>
            </article>
            <article className="stat-card">
              <div className="stat-card__top"><span>საერთო ბრუტო წონა</span><span className="stat-card__icon stat-card__icon--amber"><Boxes size={17} /></span></div>
              <div className="stat-card__value">{totalGross.toLocaleString('ka-GE', { maximumFractionDigits: 2 })}<span className="stat-card__unit">კგ</span></div>
              <div className="stat-card__note">ყველა შენახული დეკლარაცია</div>
            </article>
          </section>

          <section
            className={`upload-card${busy ? ' upload-card--busy' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              handleFile(event.dataTransfer.files?.[0])
            }}
          >
            <div className="upload-card__icon">{busy ? <LoaderCircle size={22} className="spin" /> : <FileUp size={22} />}</div>
            <div className="upload-card__copy">
              <strong>{busy ? 'PDF მუშავდება...' : 'ატვირთეთ საბაჟო დეკლარაცია'}</strong>
              <span>PDF-დან ველების ამოღება ავტომატურად ხდება. შენახვამდე მონაცემების გადამოწმება შეგიძლიათ.</span>
            </div>
            <div className="upload-card__actions">
              <span>PDF · მაქს. 20 მბ</span>
              <button className="button button--outline" onClick={() => fileInput.current?.click()} disabled={busy}>
                <ArrowDownToLine size={16} /> ფაილის არჩევა
              </button>
            </div>
          </section>

          {error && <div className="alert alert--error" role="alert"><X size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="შეტყობინების დახურვა"><X size={16} /></button></div>}
          {notice && <div className="alert alert--success" role="status"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="შეტყობინების დახურვა"><X size={16} /></button></div>}

          <section className="table-card">
            <div className="table-card__heading">
              <div><h2>დოკუმენტების რეესტრი</h2><p>ატვირთული დეკლარაციებისა და ტვირთის მონაცემები</p></div>
              <label className="search-box">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ძებნა..." aria-label="დეკლარაციების ძებნა" />
              </label>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>C ნომერი / თარიღი</th>
                    <th>EX — ექსპორტიორი / IM — იმპორტიორი</th>
                    <th>დეკლარანტი</th>
                    <th>გამომგზავნი ქვეყანა</th>
                    <th>საქონელი</th>
                    <th>საქონლის კოდი</th>
                    <th>ბრუტო კგ</th>
                    <th>საწყობი</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" className="table-state"><LoaderCircle size={20} className="spin" /> მონაცემები იტვირთება...</td></tr>
                  ) : filteredDeclarations.length ? filteredDeclarations.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.declaration_number || '—'}</strong><span className="cell-secondary">{row.declaration_date || 'თარიღი მითითებული არაა'}</span></td>
                      <td>
                        {row.exporter && <span className="party-line"><span className="trade-badge trade-badge--ex">EX</span><span>{row.exporter}</span></span>}
                        {row.importer && <span className="party-line"><span className="trade-badge trade-badge--im">IM</span><span>{row.importer}</span></span>}
                        {!row.exporter && !row.importer && '—'}
                      </td>
                      <td>{row.declarant || '—'}</td>
                      <td>{row.dispatch_country || '—'}</td>
                      <td className="goods-cell" title={row.goods_description}>{row.goods_description || '—'}</td>
                      <td>{row.commodity_code || '—'}</td>
                      <td>{row.gross_kg == null ? '—' : Number(row.gross_kg).toLocaleString('ka-GE')}</td>
                      <td>{row.warehouse_name || '—'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="8" className="empty-state">
                        <div className="empty-state__icon"><FileText size={22} /></div>
                        <strong>{query ? 'შედეგი ვერ მოიძებნა' : 'დოკუმენტები ჯერ არ არის'}</strong>
                        <span>{query ? 'სცადეთ სხვა საძიებო სიტყვა.' : 'ატვირთეთ პირველი PDF დეკლარაცია მონაცემების ამოსაღებად.'}</span>
                        {!query && <button className="button button--outline" onClick={() => fileInput.current?.click()}><Plus size={16} /> PDF-ის ატვირთვა</button>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>ნაჩვენებია <strong>{filteredDeclarations.length}</strong> / {declarations.length} ჩანაწერი</span>
              <span className="table-footer__secure"><ShieldCheck size={14} /> Neon Postgres</span>
            </div>
          </section>
          <footer className="page-footer">CargoDesk <span>·</span> საბაჟო დოკუმენტების მართვის სივრცე</footer>
        </div>
        ) : activePage === 'calculator' ? (
          <div className="page">
            <section className="page-heading">
              <div>
                <p className="eyebrow">საბაჟო გადასახადების გამოთვლა</p>
                <h1>ჯარიმის კალკულატორი</h1>
                <p className="page-heading__description">შეიყვანეთ საქონლის მონაცემები აქციზისა და დღგ-ის ჯამური თანხის გამოსათვლელად.</p>
              </div>
            </section>

            <section className="calculator-card" aria-labelledby="calculator-input-title">
              <div className="calculator-card__heading">
                <span className="stat-card__icon stat-card__icon--blue"><Calculator size={18} /></span>
                <div>
                  <h2 id="calculator-input-title">საწყისი მონაცემები</h2>
                  <p>აქციზის განაკვეთი მითითებულია ერთ ტონაზე.</p>
                </div>
              </div>
              <div className="field-grid calculator-inputs">
                <label className="form-field">
                  <span>საქონლის რაოდენობა <small>კილოგრამი</small></span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={calculatorInput.quantityKg}
                    onChange={(event) => setCalculatorInput((current) => ({ ...current, quantityKg: event.target.value }))}
                    placeholder="მაგ. 1000"
                  />
                </label>
                <label className="form-field">
                  <span>საქონლის საბაჟო ღირებულება <small>ლარი</small></span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={calculatorInput.customsValue}
                    onChange={(event) => setCalculatorInput((current) => ({ ...current, customsValue: event.target.value }))}
                    placeholder="მაგ. 2000"
                  />
                </label>
                <label className="form-field">
                  <span>აქციზის განაკვეთი <small>ლარი / ტონა</small></span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={calculatorInput.exciseRatePerTonne}
                    onChange={(event) => setCalculatorInput((current) => ({ ...current, exciseRatePerTonne: event.target.value }))}
                    placeholder="მაგ. 500"
                  />
                </label>
              </div>
              {hasCalculatorError && (
                <p className="calculator-error" role="alert">შეიყვანეთ ნულზე მეტი ან ტოლი რიცხვითი მნიშვნელობა.</p>
              )}
            </section>

            {calculation && (
              <section className="calculator-results" aria-live="polite" aria-labelledby="calculator-results-title">
                <h2 id="calculator-results-title">გამოთვლის შედეგები</h2>
                <ol className="calculation-list">
                  <li className="calculation-item">
                    <div>
                      <span className="calculation-item__number">1</span>
                      <div>
                        <h3>აქციზის გადასახადი</h3>
                        <p>
                          {formatAmount(Number(calculatorInput.quantityKg))} კგ × (
                          {formatAmount(Number(calculatorInput.exciseRatePerTonne))} ლარი / 1 000 კგ)
                          {' = '}{formatAmount(calculation.excise)} ლარი
                        </p>
                      </div>
                    </div>
                    <strong>{formatAmount(calculation.excise)} ლარი</strong>
                  </li>
                  <li className="calculation-item">
                    <div>
                      <span className="calculation-item__number">2</span>
                      <div>
                        <h3>დღგ (18%)</h3>
                        <p>
                          ({formatAmount(Number(calculatorInput.customsValue))} ლარი + {formatAmount(calculation.excise)} ლარი)
                          {' × 18% = '}{formatAmount(calculation.vat)} ლარი
                        </p>
                      </div>
                    </div>
                    <strong>{formatAmount(calculation.vat)} ლარი</strong>
                  </li>
                  <li className="calculation-item calculation-item--total">
                    <div>
                      <span className="calculation-item__number">3</span>
                      <div>
                        <h3>ჯარიმის თანხა</h3>
                        <p>{formatAmount(calculation.excise)} ლარი + {formatAmount(calculation.vat)} ლარი = {formatAmount(calculation.penalty)} ლარი</p>
                      </div>
                    </div>
                    <strong>{formatAmount(calculation.penalty)} ლარი</strong>
                  </li>
                </ol>
              </section>
            )}
            <footer className="page-footer">CargoDesk <span>·</span> საბაჟო დოკუმენტების მართვის სივრცე</footer>
          </div>
        ) : activePage === 'terminal' ? (
          <div className="page">
            <section className="page-heading terminal-heading">
              <div>
                <p className="eyebrow">საწვავის მართვა</p>
                <h1>ტერმინალი</h1>
                <p className="page-heading__description">აკონტროლეთ რეზერვუარების ტევადობა და მიმდინარე დატვირთვა.</p>
              </div>
              <button
                className="button button--primary"
                type="button"
                onClick={() => {
                  setReservoirFormError('')
                  setReservoirModalOpen(true)
                }}
                disabled={!reservoirsLoaded}
              >
                <Plus size={18} />
                რეზერვუარის დამატება
              </button>
            </section>
            <section className="terminal-summary" aria-label="რეზერვუარების შეჯამება">
              <article className="terminal-summary__item">
                <span className="terminal-summary__icon"><Boxes size={17} /></span>
                <div><span>რეზერვუარები</span><strong>{reservoirs.length}</strong></div>
              </article>
              <article className="terminal-summary__item">
                <span className="terminal-summary__icon"><Layers3 size={17} /></span>
                <div><span>ჯამური ტევადობა</span><strong>{formatCapacity(reservoirCapacityTotal)} <small>კგ</small></strong></div>
              </article>
              <article className="terminal-summary__item">
                <span className="terminal-summary__icon terminal-summary__icon--blue"><Droplets size={17} /></span>
                <div><span>მიმდინარე დატვირთვა</span><strong>{formatWeight(reservoirWeightTotal)} <small>კგ</small></strong></div>
              </article>
            </section>

            {reservoirsError && (
              <div className="alert alert--error terminal-error" role="alert">
                <X size={17} />
                <span>რეზერვუარების ჩატვირთვა ვერ მოხერხდა: {reservoirsError}</span>
                <button className="button button--outline" type="button" onClick={loadReservoirs}>ხელახლა ცდა</button>
              </div>
            )}

            <div className="terminal-workspace">
              <section className="terminal-map-card" aria-labelledby="terminal-map-title">
                <header className="terminal-card__header">
                  <div>
                    <p className="eyebrow">ობიექტის სქემა</p>
                    <h2 id="terminal-map-title">რეზერვუარების რუკა</h2>
                  </div>
                  <span className="terminal-map__count"><span /> {reservoirs.length} რეზერვუარი</span>
                </header>
                {reservoirs.length > 0 && (
                  <label className="reservoir-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                      type="search"
                      value={reservoirSearch}
                      onChange={(event) => searchReservoirs(event.target.value)}
                      placeholder="რეზერვუარის ნომრით ძებნა..."
                      aria-label="რეზერვუარის ნომრით ძებნა"
                    />
                  </label>
                )}
                {reservoirsLoading ? (
                  <div className="terminal-map__message" aria-live="polite">
                    <LoaderCircle size={20} className="spin" /> რეზერვუარები იტვირთება...
                  </div>
                ) : reservoirsError ? (
                  <div className="terminal-map__message terminal-map__message--empty">
                    მონაცემების ჩატვირთვა ვერ მოხერხდა.
                  </div>
                ) : reservoirs.length === 0 ? (
                  <div className="terminal-map__message terminal-map__message--empty">
                    <span className="terminal-empty__icon"><Boxes size={25} /></span>
                    <strong>რუკაზე რეზერვუარები ჯერ არ არის</strong>
                    <span>დაამატეთ პირველი რეზერვუარი, რომ დაიწყოთ ტევადობისა და დატვირთვის მართვა.</span>
                    <button
                      className="button button--outline"
                      type="button"
                      onClick={() => {
                        setReservoirFormError('')
                        setReservoirModalOpen(true)
                      }}
                    >
                      <Plus size={16} /> რეზერვუარის დამატება
                    </button>
                  </div>
                ) : visibleReservoirs.length === 0 ? (
                  <div className="terminal-map__message terminal-map__message--empty" role="status">
                    ამ ნომრით რეზერვუარი ვერ მოიძებნა.
                  </div>
                ) : (
                  <div className="terminal-map">
                    <svg className="terminal-map__pipes" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0 278H150V126H390V365H650V175H1000" />
                      <path d="M0 430H270V210H530V470H820V300H1000" />
                      <path d="M0 105H90V250H310V70H720V390H1000" />
                      <path d="M148 276H270M390 126H530M650 175H820" />
                      <circle cx="150" cy="278" r="7" />
                      <circle cx="390" cy="365" r="7" />
                      <circle cx="650" cy="175" r="7" />
                      <circle cx="820" cy="300" r="7" />
                    </svg>
                    <div className="terminal-map__grid">
                      {visibleReservoirs.map((reservoir) => {
                        const percent = Math.round(
                          (reservoir.current_weight_kg / reservoir.capacity_kg) * 100,
                        )
                        const isSelected = String(reservoir.id) === String(selectedReservoirId)
                        return (
                          <button
                            className={`reservoir-marker${isSelected ? ' reservoir-marker--selected' : ''}`}
                            key={reservoir.id}
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={`${reservoir.reservoir_number}, ${percent}% დატვირთული`}
                            disabled={reservoirDeleting}
                            onClick={() => selectReservoir(reservoir)}
                          >
                            <span className="reservoir-marker__labels">
                              <strong>{reservoir.reservoir_number}</strong>
                              <span>{percent}%</span>
                            </span>
                            <span className="reservoir-tank" aria-hidden="true">
                              <span
                                className="reservoir-tank__liquid"
                                style={{ height: `${percent}%` }}
                              />
                              <span className="reservoir-tank__top" />
                            </span>
                            <span className="reservoir-marker__capacity">
                              {formatWeight(reservoir.current_weight_kg)} / {formatCapacity(reservoir.capacity_kg)} კგ
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="terminal-map__legend"><span /> საწვავის მილსადენი</div>
                  </div>
                )}
              </section>

              <aside className="reservoir-details" aria-labelledby="reservoir-details-title">
                {selectedReservoir ? (
                  <>
                    <header className="terminal-card__header">
                      <div>
                        <p className="eyebrow">რეზერვუარის დეტალები</p>
                        <h2 id="reservoir-details-title">{selectedReservoir.reservoir_number}</h2>
                      </div>
                      <div className="reservoir-details__actions">
                        <span className="reservoir-details__badge">{selectedReservoirPercent}%</span>
                        <button
                          className="button button--danger reservoir-details__delete"
                          type="button"
                          onClick={() => {
                            setReservoirDeleteError('')
                            setReservoirDeleteModalOpen(true)
                          }}
                          disabled={reservoirDeleting || Boolean(reservoirMovementSaving)}
                          aria-label={`რეზერვუარის ${selectedReservoir.reservoir_number} წაშლა`}
                        >
                          {reservoirDeleting
                            ? <LoaderCircle size={15} className="spin" />
                            : <Trash2 size={15} />}
                          წაშლა
                        </button>
                      </div>
                    </header>
                    <div
                      className="reservoir-progress"
                      role="progressbar"
                      aria-label={`${selectedReservoir.reservoir_number} დატვირთვა`}
                      aria-valuemin="0"
                      aria-valuemax={selectedReservoir.capacity_kg}
                      aria-valuenow={selectedReservoir.current_weight_kg}
                    >
                      <span
                        className="reservoir-progress__fill"
                        style={{ width: `${selectedReservoirPercent}%` }}
                      />
                    </div>
                    <div className="reservoir-details__totals">
                      <span>დატვირთვა</span>
                      <strong>{formatWeight(selectedReservoir.current_weight_kg)} <small>კგ</small></strong>
                    </div>
                    <div className="reservoir-details__totals">
                      <span>ტევადობა</span>
                      <strong>{formatCapacity(selectedReservoir.capacity_kg)} <small>კგ</small></strong>
                    </div>
                    <form
                      className="reservoir-transaction-form"
                      onSubmit={(event) => moveReservoirWeight(event, 'receive')}
                    >
                      <label className="form-field">
                        <span>რეზერვუარში მიღება <small>კგ</small></span>
                        <input
                          id="reservoir-receive-weight"
                          type="number"
                          min="0.001"
                          max={selectedReservoir.capacity_kg - selectedReservoir.current_weight_kg}
                          step="0.001"
                          value={receiveWeightInput}
                          onChange={(event) => {
                            setReceiveWeightInput(event.target.value)
                            setReceiveWeightError('')
                          }}
                          disabled={Boolean(reservoirMovementSaving) || reservoirDeleting}
                          required
                        />
                      </label>
                      {receiveWeightError && (
                        <p className="reservoir-transaction-form__error" role="alert">{receiveWeightError}</p>
                      )}
                      {receiveWeightInvalid && receiveWeightInput !== '' && (
                        <p className="reservoir-transaction-form__error" role="alert">
                          მისაღები რაოდენობა დარჩენილ ტევადობას არ უნდა აღემატებოდეს.
                        </p>
                      )}
                      <button
                        className="button button--primary reservoir-transaction-form__submit"
                        type="submit"
                        disabled={Boolean(reservoirMovementSaving) || reservoirDeleting || receiveWeightInvalid}
                      >
                        {reservoirMovementSaving === 'receive' && <LoaderCircle size={16} className="spin" />}
                        მიღება
                      </button>
                    </form>
                    <form
                      className="reservoir-transaction-form"
                      onSubmit={(event) => moveReservoirWeight(event, 'release')}
                    >
                      <label className="form-field">
                        <span>რეზერვუარიდან გაშვება <small>კგ</small></span>
                        <input
                          id="reservoir-release-weight"
                          type="number"
                          min="0.001"
                          max={selectedReservoir.current_weight_kg}
                          step="0.001"
                          value={releaseWeightInput}
                          onChange={(event) => {
                            setReleaseWeightInput(event.target.value)
                            setReleaseWeightError('')
                          }}
                          disabled={Boolean(reservoirMovementSaving) || reservoirDeleting}
                          required
                        />
                      </label>
                      {releaseWeightError && (
                        <p className="reservoir-transaction-form__error" role="alert">{releaseWeightError}</p>
                      )}
                      {releaseWeightInvalid && releaseWeightInput !== '' && (
                        <p className="reservoir-transaction-form__error" role="alert">
                          გასაშვები რაოდენობა არსებულ მარაგს არ უნდა აღემატებოდეს.
                        </p>
                      )}
                      <button
                        className="button button--release reservoir-transaction-form__submit"
                        type="submit"
                        disabled={Boolean(reservoirMovementSaving) || reservoirDeleting || releaseWeightInvalid}
                      >
                        {reservoirMovementSaving === 'release' && <LoaderCircle size={16} className="spin" />}
                        გაშვება
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="reservoir-details__empty">
                    <span className="terminal-empty__icon"><Droplets size={23} /></span>
                    <strong id="reservoir-details-title">აირჩიეთ რეზერვუარი</strong>
                    <span>დატვირთვისა და ტევადობის დეტალების სანახავად აირჩიეთ რეზერვუარი რუკაზე.</span>
                  </div>
                )}
              </aside>
            </div>
          </div>
        ) : sanctionsData ? (
          <div className="page">
            <section className="page-heading">
              <div>
                <p className="eyebrow">საქონლისა და ექსპორტის შეზღუდვები</p>
                <h1>სანქციები</h1>
                <p className="page-heading__description">
                  Excel-ის რეესტრი და ოფიციალური სანქციების საძიებო ბმულები. მონაცემები განახლებულია {sanctionsData.updatedAt}.
                </p>
              </div>
            </section>

            <section className="stats-grid" aria-label="სანქციების რეესტრის სტატისტიკა">
              <article className="stat-card">
                <div className="stat-card__top"><span>სასაქონლო კოდები</span><span className="stat-card__icon stat-card__icon--blue"><Boxes size={17} /></span></div>
                <div className="stat-card__value">{sanctionsData.codedRecords.toLocaleString('ka-GE')}<span className="stat-card__unit">კოდი</span></div>
                <div className="stat-card__note">Excel-ის რეესტრში</div>
              </article>
              <article className="stat-card">
                <div className="stat-card__top"><span>სანქციის მიმართულებები</span><span className="stat-card__icon stat-card__icon--amber"><ShieldAlert size={17} /></span></div>
                <div className="stat-card__value">{sanctionsData.fields.length}<span className="stat-card__unit">სია</span></div>
                <div className="stat-card__note">EU, აშშ და სხვა კონტროლის კატეგორიები</div>
              </article>
              <article className="stat-card">
                <div className="stat-card__top"><span>ოფიციალური წყაროები</span><span className="stat-card__icon stat-card__icon--mint"><ExternalLink size={17} /></span></div>
                <div className="stat-card__value">{sanctionsData.resources.length}<span className="stat-card__unit">ბმული</span></div>
                <div className="stat-card__note">საძიებო სისტემები და რეგულაციები</div>
              </article>
            </section>

            <section className="table-card sanctions-card">
              <div className="table-card__heading sanctions-card__heading">
                <div><h2>საქონლის სანქციების რეესტრი</h2><p>ძებნა სასაქონლო კოდით, აღწერით ან შეზღუდვის მნიშვნელობით</p></div>
                <div className="sanctions-controls">
                  <label className="search-box">
                    <Search size={17} />
                    <input
                      value={sanctionsQuery}
                      onChange={(event) => {
                        setSanctionsQuery(event.target.value)
                        setSanctionsPage(1)
                      }}
                      placeholder="კოდი ან დასახელება..."
                      aria-label="სანქციების რეესტრის ძებნა"
                    />
                  </label>
                  <label className="sanctions-filter">
                    <span className="visually-hidden">სანქციის მიმართულება</span>
                    <select
                      value={sanctionsFilter}
                      onChange={(event) => {
                        setSanctionsFilter(event.target.value)
                        setSanctionsPage(1)
                      }}
                      aria-label="სანქციის მიმართულებით გაფილტვრა"
                    >
                      <option value="">ყველა მიმართულება</option>
                      {sanctionsData.fields.map((field) => (
                        <option value={field.key} key={field.key}>{field.shortLabel}</option>
                      ))}
                    </select>
                    <ChevronDown size={15} />
                  </label>
                </div>
              </div>
              <div className="table-scroll">
                <table className="sanctions-table">
                  <thead>
                    <tr><th>სასაქონლო კოდი</th><th>საქონლის აღწერა</th><th>შეზღუდვები / სიები</th><th>დეტალები</th></tr>
                  </thead>
                  <tbody>
                    {visibleSanctions.length ? visibleSanctions.map((row) => (
                      <Fragment key={row.rowNumber}>
                        <tr className={row.code ? '' : 'sanctions-table__group'}>
                          <td>{row.code || '—'}</td>
                          <td className="sanctions-table__description">{row.description || '—'}</td>
                          <td>
                            <div className="sanctions-tags">
                              {row.restrictions.slice(0, 3).map((restriction) => {
                                const field = sanctionsFieldsByKey[restriction.key]
                                const suffix = restriction.value === 'კი'
                                  ? ''
                                  : `: ${restriction.value.slice(0, 32)}${restriction.value.length > 32 ? '…' : ''}`
                                return (
                                  <span
                                    className="sanctions-tag"
                                    key={restriction.key}
                                    title={`${field.label}: ${restriction.value}`}
                                  >
                                    {field.shortLabel}{suffix}
                                  </span>
                                )
                              })}
                              {row.restrictions.length > 3 && (
                                <span className="sanctions-tag sanctions-tag--more">+{row.restrictions.length - 3}</span>
                              )}
                              {!row.restrictions.length && <span className="sanctions-table__empty">—</span>}
                            </div>
                          </td>
                          <td>
                            <button
                              className="sanctions-details-button"
                              type="button"
                              aria-expanded={expandedSanction === row.rowNumber}
                              onClick={() => setExpandedSanction((current) =>
                                current === row.rowNumber ? null : row.rowNumber,
                              )}
                            >
                              {expandedSanction === row.rowNumber ? 'დახურვა' : 'ნახვა'}
                              <ChevronDown size={14} className={expandedSanction === row.rowNumber ? 'sanctions-details-button__icon--open' : ''} />
                            </button>
                          </td>
                        </tr>
                        {expandedSanction === row.rowNumber && (
                          <tr className="sanctions-details-row">
                            <td colSpan="4">
                              {row.restrictions.length ? (
                                <dl className="sanctions-details-list">
                                  {row.restrictions.map((restriction) => (
                                    <div key={restriction.key}>
                                      <dt>{sanctionsFieldsByKey[restriction.key].label}</dt>
                                      <dd>{restriction.value}</dd>
                                    </div>
                                  ))}
                                </dl>
                              ) : (
                                <p>ამ ჩანაწერზე დამატებითი შეზღუდვა მითითებული არ არის.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )) : (
                      <tr><td colSpan="4" className="empty-state sanctions-empty-state">
                        <div className="empty-state__icon"><Search size={22} /></div>
                        <strong>შედეგი ვერ მოიძებნა</strong>
                        <span>შეცვალეთ საძიებო სიტყვა ან სანქციის მიმართულება.</span>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-footer sanctions-card__footer">
                <span>ნაჩვენებია <strong>{filteredSanctions.length ? (sanctionsPage - 1) * sanctionsPageSize + 1 : 0}–{Math.min(sanctionsPage * sanctionsPageSize, filteredSanctions.length)}</strong> / {filteredSanctions.length.toLocaleString('ka-GE')} ჩანაწერი</span>
                <div className="sanctions-pagination" aria-label="რეესტრის გვერდები">
                  <button
                    type="button"
                    aria-label="წინა გვერდი"
                    onClick={() => {
                      setSanctionsPage((current) => current - 1)
                      setExpandedSanction(null)
                    }}
                    disabled={sanctionsPage <= 1}
                  ><ChevronLeft size={16} /></button>
                  <span>{sanctionsPage} / {sanctionsPageCount}</span>
                  <button
                    type="button"
                    aria-label="შემდეგი გვერდი"
                    onClick={() => {
                      setSanctionsPage((current) => current + 1)
                      setExpandedSanction(null)
                    }}
                    disabled={sanctionsPage >= sanctionsPageCount}
                  ><ChevronRight size={16} /></button>
                </div>
              </div>
            </section>

            <section className="sanctions-resources" aria-labelledby="sanctions-resources-title">
              <div className="sanctions-resources__heading">
                <div><h2 id="sanctions-resources-title">საძიებო სისტემები და წყაროები</h2><p>Excel-ის ფაილში მითითებული ოფიციალური ბმულები</p></div>
              </div>
              <div className="sanctions-resource-grid">
                {Array.from(new Set(sanctionsData.resources.map((resource) => resource.group))).map((group) => (
                  <article className="sanctions-resource-card" key={group}>
                    <h3>{group}</h3>
                    <ul>
                      {sanctionsData.resources.filter((resource) => resource.group === group).map((resource) => (
                        <li key={resource.url}>
                          <a href={resource.url} target="_blank" rel="noreferrer">
                            <span>{resource.label}</span><ExternalLink size={14} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
            <footer className="page-footer">CargoDesk <span>·</span> სანქციების რეესტრი · განახლებულია {sanctionsData.updatedAt}</footer>
          </div>
        ) : (
          <div className="page">
            <section className="sanctions-loading" aria-live="polite">
              {sanctionsError ? (
                <>
                  <div className="alert alert--error" role="alert">
                    <X size={17} />
                    <span>სანქციების მონაცემების ჩატვირთვა ვერ მოხერხდა: {sanctionsError}</span>
                  </div>
                  <button className="button button--outline" type="button" onClick={loadSanctions}>ხელახლა ცდა</button>
                </>
              ) : (
                <><LoaderCircle size={20} className="spin" /> სანქციების რეესტრი იტვირთება...</>
              )}
            </section>
          </div>
        )}
      </main>

      {reservoirModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reservoirSaving) {
              setReservoirModalOpen(false)
            }
          }}
        >
          <section
            className="review-modal reservoir-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservoir-modal-title"
          >
            <header className="review-modal__header">
              <div>
                <div className="review-modal__icon"><Boxes size={20} /></div>
                <div>
                  <p className="eyebrow">ტერმინალი</p>
                  <h2 id="reservoir-modal-title">რეზერვუარის დამატება</h2>
                </div>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setReservoirModalOpen(false)}
                disabled={reservoirSaving}
                aria-label="დახურვა"
              >
                <X size={20} />
              </button>
            </header>
            {reservoirFormError && (
              <div className="alert alert--error" role="alert">
                <X size={17} /><span>{reservoirFormError}</span>
              </div>
            )}
            <form onSubmit={addReservoir}>
              <div className="field-grid reservoir-modal__fields">
                <label className="form-field form-field--wide">
                  <span>რეზერვუარის ნომერი</span>
                  <input
                    id="reservoir-number"
                    type="text"
                    maxLength="60"
                    value={reservoirNumber}
                    onChange={(event) => setReservoirNumber(event.target.value)}
                    placeholder="მაგ. R-01"
                    autoFocus
                    required
                  />
                </label>
                <label className="form-field form-field--wide">
                  <span>ტევადობა <small>კგ</small></span>
                  <input
                    id="reservoir-capacity"
                    type="number"
                    min="0.001"
                    max="99999999999.999"
                    step="0.001"
                    value={reservoirCapacity}
                    onChange={(event) => setReservoirCapacity(event.target.value)}
                    placeholder="მაგ. 2500"
                    required
                  />
                </label>
              </div>
              <div className="review-modal__footer">
                <span>ახალი რეზერვუარი რუკაზე ცარიელი გამოჩნდება.</span>
                <div>
                  <button
                    className="button button--outline"
                    type="button"
                    onClick={() => setReservoirModalOpen(false)}
                    disabled={reservoirSaving}
                  >
                    გაუქმება
                  </button>
                  <button className="button button--primary" type="submit" disabled={reservoirSaving}>
                    {reservoirSaving ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
                    დამატება
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {reservoirDeleteModalOpen && selectedReservoir && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reservoirDeleting) {
              setReservoirDeleteModalOpen(false)
            }
          }}
        >
          <section
            className="review-modal reservoir-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservoir-delete-modal-title"
            aria-describedby="reservoir-delete-modal-description"
          >
            <header className="review-modal__header">
              <div>
                <div className="review-modal__icon review-modal__icon--danger"><Trash2 size={20} /></div>
                <div>
                  <p className="eyebrow">რეზერვუარის წაშლა</p>
                  <h2 id="reservoir-delete-modal-title">დაადასტურეთ წაშლა</h2>
                </div>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setReservoirDeleteModalOpen(false)}
                disabled={reservoirDeleting}
                aria-label="დახურვა"
              >
                <X size={20} />
              </button>
            </header>
            <p className="reservoir-delete-modal__description" id="reservoir-delete-modal-description">
              ნამდვილად გსურთ რეზერვუარის <strong>{selectedReservoir.reservoir_number}</strong> წაშლა?
              ეს მოქმედება შეუქცევადია და წაშლის რეზერვუარსა და მის მიმდინარე მარაგს.
            </p>
            <div className="reservoir-delete-modal__weight">
              მიმდინარე მარაგი
              <strong>{formatWeight(selectedReservoir.current_weight_kg)} კგ</strong>
            </div>
            {reservoirDeleteError && (
              <div className="alert alert--error reservoir-delete-modal__error" role="alert">
                <X size={17} /><span>{reservoirDeleteError}</span>
              </div>
            )}
            <div className="review-modal__footer">
              <span>რეზერვუარის წაშლის შემდეგ მონაცემების აღდგენა ვერ მოხერხდება.</span>
              <div>
                <button
                  className="button button--outline"
                  type="button"
                  onClick={() => setReservoirDeleteModalOpen(false)}
                  disabled={reservoirDeleting}
                >
                  გაუქმება
                </button>
                <button
                  className="button button--danger"
                  type="button"
                  onClick={deleteReservoir}
                  disabled={reservoirDeleting}
                >
                  {reservoirDeleting
                    ? <LoaderCircle size={16} className="spin" />
                    : <Trash2 size={16} />}
                  წაშლა
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {draft && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setDraft(null)
        }}>
          <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <header className="review-modal__header">
              <div><div className="review-modal__icon"><FileText size={20} /></div><div><p className="eyebrow">PDF წარმატებით დამუშავდა</p><h2 id="review-title">გადაამოწმეთ მონაცემები</h2></div></div>
              <button className="icon-button" onClick={() => setDraft(null)} disabled={busy} aria-label="დახურვა"><X size={20} /></button>
            </header>
            <div className="file-summary"><FileText size={16} /><span>{draft.sourceFilename}</span><span className="file-summary__pages">{draft.pageCount} გვ.</span></div>
            {!draft.hasText && <div className="alert alert--warning">PDF-ში ამოსაკითხი ტექსტი ვერ მოიძებნა. ველები ხელით შეავსეთ და შემდეგ შეინახეთ.</div>}
            {error && <div className="alert alert--error" role="alert"><X size={17} /><span>{error}</span></div>}
            <form onSubmit={saveDeclaration}>
              <div className="field-grid">
                {fields.map((field) => (
                  <label className={`form-field${field.key === 'goodsDescription' ? ' form-field--wide' : ''}`} key={field.key}>
                    <span>{field.label}<small>{field.hint}</small></span>
                    <input
                      type={field.key === 'grossKg' ? 'number' : 'text'}
                      step={field.key === 'grossKg' ? 'any' : undefined}
                      min={field.key === 'grossKg' ? '0' : undefined}
                      value={draft[field.key]}
                      onChange={(event) => updateDraft(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  </label>
                ))}
              </div>
              <div className="review-modal__footer">
                <span>შენახვამდე შეგიძლიათ ამოღებული მონაცემების შესწორება.</span>
                <div><button className="button button--outline" type="button" onClick={() => setDraft(null)} disabled={busy}>გაუქმება</button><button className="button button--primary" type="submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />} შენახვა</button></div>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
