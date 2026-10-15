import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Calculator,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  FileUp,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { calculateExcisePenalty } from './calculator.js'

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
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef(null)

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

  useEffect(() => {
    loadDeclarations()
  }, [])

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
          <div className="breadcrumbs"><span>სამუშაო სივრცე</span><span className="breadcrumbs__slash">/</span><strong>{activePage === 'declarations' ? 'დეკლარაციები' : 'ჯარიმის კალკულატორი'}</strong></div>
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
        ) : (
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
        )}
      </main>

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
