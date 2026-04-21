import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================
// ⚙️  КОНФИГУРАЦИЯ — URL Google Apps Script
// ============================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwzVNc1YZmzTx6zgy2UobQdxx20ieeMoGx8SBX8wAzWvJOrIQYED5qJ1MpGi4DZlfP0/exec'
const LS_KEY = 'clown-cup-teams'

// Количество игроков в команде
const TEAM_SIZE = 5

// ============================================================
// 🔧 УТИЛИТЫ
// ============================================================

/** Все запросы через GET — единственный надёжный способ с Apps Script без CORS */
async function fetchTeamsFromSheet() {
  const url = new URL(SCRIPT_URL)
  url.searchParams.set('action', 'getTeams')
  const resp = await fetch(url.toString(), { cache: 'no-store' })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  const data = await resp.json()
  if (!Array.isArray(data)) throw new Error('Неверный формат ответа')
  return data
}

async function saveTeamToSheet(team) {
  const url = new URL(SCRIPT_URL)
  url.searchParams.set('action', 'addTeam')
  url.searchParams.set('data', JSON.stringify(team))
  const resp = await fetch(url.toString(), { cache: 'no-store' })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  return await resp.json()
}

async function deleteTeamFromSheet(id) {
  const url = new URL(SCRIPT_URL)
  url.searchParams.set('action', 'deleteTeam')
  url.searchParams.set('id', id)
  const resp = await fetch(url.toString(), { cache: 'no-store' })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  return await resp.json()
}

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || [] } catch { return [] }
}
function lsSave(teams) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(teams)) } catch {}
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const emptyPlayer = () => ({ nick: '', dota: '', cs2: '' })

// ============================================================
// 🍞 Toast
// ============================================================
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-3 max-w-xs w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-enter pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl ${
            t.type === 'success' ? 'bg-green-950/80 border-green-500/40 text-green-300'
            : t.type === 'error' ? 'bg-red-950/80 border-red-500/40 text-red-300'
            : 'bg-blue-950/80 border-blue-500/40 text-blue-300'
          }`}
        >
          <span className="text-xl flex-shrink-0">
            {t.type === 'success' ? '✅' : t.type === 'error' ? '⚠️' : 'ℹ️'}
          </span>
          <span className="text-sm font-semibold leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// 🎨 HeroCanvas — интерактивная анимация нитей
// ============================================================
function HeroCanvas() {
  const canvasRef = useRef(null)
  const resetHandlerRef = useRef(null)

  useEffect(() => {
    const C = canvasRef.current
    if (!C) return
    const X = C.getContext('2d')
    let W, H, rafId

    // Цвета нитей — неоновая палитра под тему сайта
    const COLS = ['#00ff88', '#00aaff', '#bf00ff', '#ffcc00', '#ff4488']
    let ci = 0

    // SVG-логотип турнира
    function makeSVG() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600">
        <style>
          .t { font-family: "Arial Black", Impact, sans-serif; text-anchor: middle; font-weight: 900; }
          .big { font-size: 82px; letter-spacing: 6px; }
          .med { font-size: 44px; letter-spacing: 8px; }
        </style>
        <g transform="translate(500,300)">
          <text class="t big" fill="white" y="-60">CLOWN</text>
          <text class="t med" fill="#888" y="28">CHAMPIONSHIP</text>
          <text class="t big" fill="white" y="115">CUP</text>
        </g>
      </svg>`
    }

    function loadImg(svg) {
      return new Promise(r => {
        const i = new Image()
        i.onload = () => r(i)
        i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      })
    }

    let logoImg, collData, LS, LOX, LOY, LW, LH, ready = false

    async function buildLogo() {
      ready = false
      logoImg = await loadImg(makeSVG())
      LS = (W * 0.65) / 1000
      LW = 1000 * LS; LH = 600 * LS
      LOX = (W - LW) / 2; LOY = (H - LH) / 2

      const cc = document.createElement('canvas')
      cc.width = W; cc.height = H
      const cx = cc.getContext('2d')
      cx.drawImage(logoImg, LOX, LOY, LW, LH)
      collData = cx.getImageData(0, 0, W, H).data
      ready = true
    }

    function hit(x, y) {
      if (!ready) return false
      const ix = Math.round(x), iy = Math.round(y)
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) return false
      return collData[(iy * W + ix) * 4 + 3] > 30
    }

    // --- Физика частиц ---
    class Pt {
      constructor(x, y) {
        this.x = x; this.y = y; this.ox = x; this.oy = y
        this.done = false; this.st = 0
      }
      update() {
        if (this.done) return
        const g = 0.4 * 0.3 // гравитация
        let vx = (this.x - this.ox) * 0.97
        let vy = (this.y - this.oy) * 0.97
        this.ox = this.x; this.oy = this.y
        this.x += vx; this.y += vy + g

        if (hit(this.x, this.y)) {
          if (!hit(this.x, this.oy))      { this.y = this.oy }
          else if (!hit(this.ox, this.y)) { this.x = this.ox }
          else                             { this.x = this.ox; this.y = this.oy }
          this.st += 4
        }
        if (this.y > H - 1) { this.y = H - 1; this.st += 4 }
        if (this.st > 20) this.done = true
      }
    }

    class Lk {
      constructor(a, b) { this.a = a; this.b = b; this.l = 2.5; this.broken = false }
      solve() {
        if (this.broken) return
        const dx = this.b.x - this.a.x, dy = this.b.y - this.a.y
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001
        if (d > 30) { this.broken = true; return }
        const f = (this.l - d) / d * 0.25
        if (!this.a.done) { this.a.x -= dx * f; this.a.y -= dy * f }
        if (!this.b.done) { this.b.x += dx * f; this.b.y += dy * f }
      }
    }

    class Strand {
      constructor(i) { this.pts = []; this.lks = []; this.ci = i }
      add(x, y, vx, vy) {
        const p = new Pt(x, y); p.ox = x - vx; p.oy = y - vy
        if (this.pts.length) this.lks.push(new Lk(this.pts[this.pts.length - 1], p))
        this.pts.push(p)
      }
    }

    let strands = []
    let mx = 0, my = 0, spraying = false, cur = null, spT = 0
    let demo = true, demoT = 0

    // Конфиг (жёстко заданные значения)
    const pressure = 55, curlAmt = 35, chaosAmt = 20, thickAmt = 40

    function emitFrom(cx, cy) {
      if (!cur) return
      spT++
      const a = Math.atan2(LOY + LH / 2 - cy, LOX + LW / 2 - cx)
      const spd = 3 + pressure / 100 * 11
      for (let j = 0; j < 3; j++) {
        const speed = spd + Math.random() * 2
        const curl = Math.sin(spT * 0.35 + j * 1.7) * (curlAmt / 100 * 4)
        const wobble = (Math.random() - 0.5) * (0.2 + chaosAmt / 100)
        cur.add(cx, cy, Math.cos(a + wobble) * speed, Math.sin(a + wobble) * speed + curl)
      }
      let tot = 0
      for (const s of strands) tot += s.pts.length
      if (tot > 10000 && strands.length > 1) strands.shift()
    }

    function doReset() {
      strands = []; ci = 0; demo = true; demoT = 0
    }

    // Экспонируем reset наружу через ref
    resetHandlerRef.current = doReset

    function tick() {
      rafId = requestAnimationFrame(tick)
      demoT++

      let canX = mx, canY = my
      if (demo) {
        canX = W * 0.5 + Math.cos(demoT * 0.02) * W * 0.3
        canY = H * 0.15
        if (demoT % 5 === 0) {
          if (!cur || cur.pts.length > 100) {
            cur = new Strand(ci++ % COLS.length)
            strands.push(cur)
          }
          spraying = true
        }
      }

      // Фон — почти чёрный, как основной фон сайта
      X.fillStyle = '#050510'
      X.fillRect(0, 0, W, H)

      if (spraying) emitFrom(canX, canY)

      // Рисуем нити
      for (const s of strands) {
        for (const p of s.pts) p.update()
        for (let i = 0; i < 2; i++) for (const k of s.lks) k.solve()

        if (s.pts.length < 2) continue
        X.beginPath()
        X.strokeStyle = COLS[s.ci]
        X.lineWidth = thickAmt / 100 * 4 + 1
        X.lineCap = 'round'
        X.moveTo(s.pts[0].x, s.pts[0].y)
        for (let i = 1; i < s.pts.length; i++) {
          if (s.lks[i - 1] && s.lks[i - 1].broken) {
            X.moveTo(s.pts[i].x, s.pts[i].y); continue
          }
          X.lineTo(s.pts[i].x, s.pts[i].y)
        }
        X.stroke()
      }

      // Логотип поверх нитей
      if (logoImg) X.drawImage(logoImg, LOX, LOY, LW, LH)

      // Курсор-инструмент (виден только при ручном режиме)
      if (!demo) {
        X.save()
        X.translate(canX, canY)
        X.rotate(Math.atan2(LOY + LH / 2 - canY, LOX + LW / 2 - canX) + Math.PI / 2)
        X.fillStyle = '#00ff88'
        X.globalAlpha = 0.85
        X.beginPath(); X.arc(-8, 10, 10, 0, 7); X.fill()
        X.beginPath(); X.arc(8, 10, 10, 0, 7); X.fill()
        X.beginPath(); X.ellipse(0, -12, 8, 20, 0, 0, 7); X.fill()
        X.globalAlpha = 1
        X.restore()
      }
    }

    // Ресайз
    const resize = () => {
      W = C.width = C.parentElement ? C.parentElement.clientWidth : window.innerWidth
      H = C.height = C.parentElement ? C.parentElement.clientHeight : window.innerHeight
      buildLogo()
    }
    resize()
    window.addEventListener('resize', resize)

    // События мыши на самом canvas
    const onMouseDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return
      const rect = C.getBoundingClientRect()
      mx = e.clientX - rect.left; my = e.clientY - rect.top
      demo = false; spraying = true; spT = 0
      cur = new Strand(ci++ % COLS.length); strands.push(cur)
    }
    const onMouseUp = () => { spraying = false; cur = null }
    const onMouseMove = (e) => {
      const rect = C.getBoundingClientRect()
      mx = e.clientX - rect.left; my = e.clientY - rect.top
    }
    const onTouchMove = (e) => {
      e.preventDefault()
      const rect = C.getBoundingClientRect()
      const t = e.touches[0]
      mx = t.clientX - rect.left; my = t.clientY - rect.top
    }
    const onTouchStart = (e) => {
      const rect = C.getBoundingClientRect()
      const t = e.touches[0]
      mx = t.clientX - rect.left; my = t.clientY - rect.top
      demo = false; spraying = true; spT = 0
      cur = new Strand(ci++ % COLS.length); strands.push(cur)
    }
    const onTouchEnd = () => { spraying = false; cur = null }

    C.addEventListener('mousedown', onMouseDown)
    C.addEventListener('mouseup', onMouseUp)
    C.addEventListener('mousemove', onMouseMove)
    C.addEventListener('touchstart', onTouchStart, { passive: false })
    C.addEventListener('touchmove', onTouchMove, { passive: false })
    C.addEventListener('touchend', onTouchEnd)

    tick()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      C.removeEventListener('mousedown', onMouseDown)
      C.removeEventListener('mouseup', onMouseUp)
      C.removeEventListener('mousemove', onMouseMove)
      C.removeEventListener('touchstart', onTouchStart)
      C.removeEventListener('touchmove', onTouchMove)
      C.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return (
    <section
      style={{ position: 'relative', height: '100vh', overflow: 'hidden', cursor: 'none' }}
    >
      {/* Сам холст */}
      <canvas
        ref={canvasRef}
        style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Кнопка Reset */}
      <button
        onClick={() => resetHandlerRef.current?.()}
        style={{ cursor: 'pointer' }}
        className="absolute top-4 left-4 z-10 text-xs font-mono px-3 py-1.5 rounded-md border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-all bg-black/20"
      >
        Reset
      </button>

      {/* Мемный тикер сверху */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 meme-tag text-green-400 tracking-widest whitespace-nowrap pointer-events-none">
        ⚡ NOT FOR SALE · 322 РУЛЯ · GG WP · SKIBIDI · BOMBADIRO ⚡
      </div>

      {/* Кнопка вниз + хинт */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4">
        <a
          href="#formats"
          className="btn-glitch btn-main inline-block px-10 py-4 rounded-2xl text-black font-black text-xl uppercase tracking-widest"
          data-text="ЗАПИСАТЬ ПАТИ"
          style={{ background: 'linear-gradient(135deg, #00ff88, #00aaff)', cursor: 'pointer' }}
        >
          ЗАПИСАТЬ ПАТИ 🚀
        </a>
        <div className="text-gray-600 animate-bounce text-2xl select-none pointer-events-none">↓</div>
      </div>

      {/* Хинт «кликай» */}
      <p className="absolute bottom-5 right-5 z-10 text-xs text-white/15 font-mono pointer-events-none select-none">
        кликай и тащи
      </p>
    </section>
  )
}

// ============================================================
// 🎮 FormatsSection — описание форматов турнира
// ============================================================
function FormatsSection() {
  return (
    <section id="formats" className="relative py-20 px-4 text-center overflow-hidden">
      {/* Декоративные блюры */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl mx-auto">
        <div className="meme-tag text-green-400 mb-4 tracking-widest">
          ⚡ ФОРМАТЫ ТУРНИРА ⚡
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3 leading-tight">
          <span className="text-gradient-green">Три игры</span>
          <span className="text-white"> — </span>
          <span className="text-gradient-purple">одна легенда</span>
        </h2>
        <p className="text-gray-500 text-sm mb-10">
          Бомбардиро Крокодило одобряет · Тралалело Тралала · Итальянский брейнрот
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {/* Dota 2 */}
          <div className="team-card rounded-2xl p-5 text-left">
            <div className="game-badge badge-dota mb-3">🎮 Dota 2</div>
            <p className="text-sm text-gray-300 leading-relaxed">
              <span className="font-black text-red-400">BO1 Captains Draft</span>
              <br />
              Рандомные герои. Скрипт и удача решают. Плачь в дискорде.
            </p>
          </div>

          {/* CS2 */}
          <div className="team-card rounded-2xl p-5 text-left">
            <div className="game-badge badge-cs2 mb-3">💥 CS2</div>
            <p className="text-sm text-gray-300 leading-relaxed">
              <span className="font-black text-orange-400">BO1 Mirage / Inferno</span>
              <br />
              Карта по договорённости. Blame the teammate.
            </p>
          </div>

          {/* Wormix */}
          <div className="team-card rounded-2xl p-5 text-left">
            <div className="game-badge badge-worm mb-3">🐛 Wormix</div>
            <p className="text-sm text-gray-300 leading-relaxed">
              <span className="font-black text-green-400">BO1 Дуэль на арене</span>
              <br />
              Проигравший кидает донат стримеру с песней{' '}
              <span className="text-yellow-400 font-black">«Ко-ко-шнейне»</span> 🐔
            </p>
          </div>
        </div>

        <a
          href="#register"
          className="btn-glitch btn-main inline-block px-10 py-4 rounded-2xl text-black font-black text-lg uppercase tracking-widest"
          data-text="ЗАРЕГИСТРИРОВАТЬСЯ"
          style={{ background: 'linear-gradient(135deg, #00ff88, #00aaff)' }}
        >
          ЗАРЕГИСТРИРОВАТЬСЯ 🎮
        </a>
      </div>
    </section>
  )
}

// ============================================================
// 📝 Строка одного игрока в форме
// ============================================================
function PlayerRow({ index, player, isCapitan, onChange }) {
  const label = isCapitan ? '👑 Капитан' : `Игрок ${index + 1}`
  const borderColor = isCapitan ? 'border-yellow-500/30' : 'border-white/5'

  return (
    <div className={`rounded-xl border ${borderColor} p-4 bg-white/2`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</span>
        {isCapitan && <span className="text-xs text-yellow-500 font-bold">(заполняет форму)</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">Ник</label>
          <input
            type="text"
            placeholder={isCapitan ? 'Твой ник' : 'Ник игрока'}
            value={player.nick}
            onChange={(e) => onChange(index, 'nick', e.target.value)}
            maxLength={40}
            className="neon-input w-full px-3 py-2 rounded-lg text-sm font-semibold"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">
            <span className="text-red-400">🎮</span> MMR Dota 2
          </label>
          <input
            type="text"
            placeholder="Напр: 5000 / Анч 1"
            value={player.dota}
            onChange={(e) => onChange(index, 'dota', e.target.value)}
            maxLength={30}
            className="neon-input w-full px-3 py-2 rounded-lg text-sm font-semibold"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">
            <span className="text-orange-400">💥</span> ELO CS2
          </label>
          <input
            type="text"
            placeholder="Напр: 2100 / GN2"
            value={player.cs2}
            onChange={(e) => onChange(index, 'cs2', e.target.value)}
            maxLength={30}
            className="neon-input w-full px-3 py-2 rounded-lg text-sm font-semibold"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 📝 Форма регистрации команды
// ============================================================
function RegistrationForm({ onTeamAdded, addToast }) {
  const [teamName, setTeamName] = useState('')
  const [contact, setContact]   = useState('')
  const [players, setPlayers]   = useState(Array.from({ length: TEAM_SIZE }, emptyPlayer))
  const [wormix, setWormix]     = useState('')
  const [loading, setLoading]   = useState(false)

  const handlePlayerChange = (idx, field, value) => {
    setPlayers((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!teamName.trim()) { addToast('Введи название команды! 🤡', 'error'); return }
    if (!contact.trim())  { addToast('Укажи Discord / контакт капитана! 📞', 'error'); return }
    if (!players[0].nick.trim() || !players[0].dota.trim() || !players[0].cs2.trim()) {
      addToast('Заполни данные капитана полностью! 👑', 'error'); return
    }
    if (!wormix.trim()) { addToast('Введи ник команды в Wormix! 🐛', 'error'); return }

    const activePlayers = players.map((p, i) => {
      if (i === 0) return p
      return p.nick.trim() ? p : null
    }).filter(Boolean)

    const team = {
      id: genId(),
      teamName: teamName.trim(),
      contact: contact.trim(),
      players: activePlayers,
      wormix: wormix.trim(),
      registeredAt: new Date().toISOString(),
    }

    setLoading(true)
    try {
      await saveTeamToSheet(team)
      addToast('Заявка улетела в штаб! ✈️ GG WP', 'success')
    } catch (err) {
      const backup = lsLoad()
      backup.push(team)
      lsSave(backup)
      addToast('Проблемы со связью — сохранили локально 💾', 'error')
      console.warn('Sheets error:', err)
    }

    onTeamAdded(team)
    setTeamName(''); setContact(''); setWormix('')
    setPlayers(Array.from({ length: TEAM_SIZE }, emptyPlayer))
    setLoading(false)
  }

  return (
    <section id="register" className="py-20 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="meme-tag text-purple-400 mb-3">// РЕГИСТРАЦИЯ КОМАНДЫ</div>
          <h2 className="text-3xl sm:text-4xl font-black">
            <span className="text-gradient-purple">Записать</span>{' '}
            <span className="text-white">Пати</span>
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            Заполняет капитан за всю команду. Слабаки не регистрируются.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="team-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5 uppercase tracking-widest">
                🏷️ Название команды
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="SkibidiGang322 💀"
                maxLength={50}
                className="neon-input w-full px-4 py-3 rounded-xl text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5 uppercase tracking-widest">
                📞 Discord / контакт капитана
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="@username или +7..."
                maxLength={50}
                className="neon-input w-full px-4 py-3 rounded-xl text-sm font-semibold"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Состав команды</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <p className="text-xs text-gray-600 text-center mb-4">
              Игрок 1 — обязателен. Остальные — по наличию в составе.
            </p>
            <div className="space-y-3">
              {players.map((p, i) => (
                <PlayerRow
                  key={i}
                  index={i}
                  player={p}
                  isCapitan={i === 0}
                  onChange={handlePlayerChange}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest">🐛 Wormix</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <label className="block text-xs font-black text-gray-400 mb-1.5 uppercase tracking-widest">
              Ник команды / игрока в Wormix
            </label>
            <input
              type="text"
              value={wormix}
              onChange={(e) => setWormix(e.target.value)}
              placeholder="WormSlayer9000"
              maxLength={40}
              className="neon-input w-full px-4 py-3 rounded-xl text-sm font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-glitch w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest text-black transition-all disabled:opacity-50"
            data-text="ПОГНАЛИ 🚀"
            style={{
              background: loading
                ? 'rgba(0,255,136,0.4)'
                : 'linear-gradient(135deg, #00ff88, #00aaff)',
            }}
          >
            {loading ? '⏳ Отправляем в штаб...' : 'ПОГНАЛИ 🚀'}
          </button>
        </form>
      </div>
    </section>
  )
}

// ============================================================
// 🃏 Карточка команды
// ============================================================
function TeamCard({ team, index, isOrganizer, onKick }) {
  const [kicking, setKicking] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleKick = async () => {
    if (!window.confirm(`Кикнуть «${team.teamName}»? Безвозвратно! 💀`)) return
    setKicking(true)
    try { await deleteTeamFromSheet(team.id) } catch {}
    onKick(team.id)
  }

  const medals = ['🥇', '🥈', '🥉']
  const medal = medals[index] || `#${index + 1}`

  return (
    <div className="team-card rounded-2xl overflow-hidden">
      <div
        className="p-5 flex items-center gap-4 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="text-2xl font-black w-10 text-center flex-shrink-0">{medal}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-lg text-white truncate">{team.teamName}</h3>
          <div className="flex flex-wrap gap-2 mt-1.5">
            <span className="text-xs text-gray-500">
              👥 {team.players?.length || 1} игр.
            </span>
            <span className="text-xs text-gray-500">
              🐛 {team.wormix}
            </span>
            {team.contact && (
              <span className="text-xs text-gray-500">
                📞 {team.contact}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {team.registeredAt && (
            <span className="text-xs text-gray-600 hidden sm:block">
              {new Date(team.registeredAt).toLocaleDateString('ru-RU', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
          <span
            className="text-gray-600 text-sm transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs font-black text-gray-600 uppercase tracking-widest px-1 mb-3">
              <span>Игрок</span>
              <span>🎮 MMR Dota 2</span>
              <span>💥 ELO CS2</span>
            </div>
            {(team.players || []).map((p, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 gap-2 px-3 py-2 rounded-lg text-sm ${
                  i === 0 ? 'bg-yellow-500/5 border border-yellow-500/20' : 'bg-white/3'
                }`}
              >
                <span className="font-bold text-white truncate flex items-center gap-1.5">
                  {i === 0 && <span className="text-yellow-400 text-xs">👑</span>}
                  {p.nick || '—'}
                </span>
                <span className="text-red-300 font-semibold truncate">{p.dota || '—'}</span>
                <span className="text-orange-300 font-semibold truncate">{p.cs2 || '—'}</span>
              </div>
            ))}
          </div>

          {isOrganizer && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleKick}
                disabled={kicking}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-950/50 border border-red-500/30 text-red-400 hover:bg-red-900/50 hover:border-red-500/60 transition-all disabled:opacity-40"
              >
                {kicking ? '⏳' : '❌ Кикнуть команду'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 📋 Список команд
// ============================================================
function TeamsList({ teams, isOrganizer, onOrganizerToggle, onKick, loading }) {

  const copyToClipboard = () => {
    if (!teams.length) return
    const lines = ['Команда\tКонтакт\tИгрок\tDota MMR\tCS2 ELO\tWormix\tДата']
    teams.forEach((t) => {
      const date = t.registeredAt ? new Date(t.registeredAt).toLocaleString('ru-RU') : '—'
      ;(t.players || []).forEach((p, i) => {
        lines.push(`${i === 0 ? t.teamName : ''}\t${i === 0 ? t.contact : ''}\t${p.nick}\t${p.dota}\t${p.cs2}\t${i === 0 ? t.wormix : ''}\t${i === 0 ? date : ''}`)
      })
    })
    navigator.clipboard.writeText(lines.join('\n'))
  }

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(teams, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clown-cup-teams-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="py-10 px-4 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="neon-divider mb-10" />

        <div className="text-center mb-8">
          <div className="meme-tag text-green-400 mb-3">// ЗАРЕГИСТРИРОВАННЫЕ КОМАНДЫ</div>
          <h2 className="text-3xl sm:text-4xl font-black">
            <span className="text-gradient-green">Пати</span>{' '}
            <span className="text-white">в деле</span>{' '}
            <span className="text-gray-400">({teams.length})</span>
          </h2>
          <p className="text-xs text-gray-600 mt-2">Нажми на карточку, чтобы увидеть состав</p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <button
            onClick={copyToClipboard}
            disabled={!teams.length}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-blue-400 bg-blue-950/40 border border-blue-500/20 hover:border-blue-500/50 transition-all disabled:opacity-30"
          >
            📋 Скопировать для Excel
          </button>
          <button
            onClick={downloadJSON}
            disabled={!teams.length}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-purple-400 bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/50 transition-all disabled:opacity-30"
          >
            📥 Скачать JSON
          </button>
        </div>

        <label className="flex items-center gap-3 justify-center mb-8 cursor-pointer select-none group">
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={isOrganizer}
            onChange={(e) => onOrganizerToggle(e.target.checked)}
          />
          <span className="text-sm font-bold text-purple-400 group-hover:text-purple-300 transition-colors">
            Режим организатора (показать кнопки «Кикнуть»)
          </span>
        </label>

        {loading && (
          <div className="text-center text-gray-500 py-10 text-sm font-bold animate-pulse">
            Загружаем команды из штаба...
          </div>
        )}

        {!loading && teams.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 select-none">🏜️</div>
            <p className="text-gray-500 font-bold text-lg">Пока никого нет.</p>
            <p className="text-gray-600 text-sm mt-1">Будь первым! GG WP</p>
          </div>
        )}

        <div className="space-y-3">
          {teams.map((team, i) => (
            <TeamCard
              key={team.id}
              team={team}
              index={i}
              isOrganizer={isOrganizer}
              onKick={onKick}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================
// 🧭 Навбар
// ============================================================
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-black/70 backdrop-blur-md border-b border-white/5' : ''}`}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="font-black text-sm tracking-widest uppercase">
          <span className="text-gradient-green">Clown</span>
          <span className="text-white">Cup</span>
          <span className="text-gray-600 ml-1 text-xs">v2</span>
        </div>
        <a
          href="#register"
          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-black"
          style={{ background: 'linear-gradient(135deg, #00ff88, #00aaff)' }}
        >
          Записаться
        </a>
      </div>
    </nav>
  )
}

// ============================================================
// 🦶 Footer
// ============================================================
function Footer() {
  return (
    <footer className="text-center py-8 px-4 border-t border-white/5">
      <p className="text-xs text-gray-700 font-bold tracking-wider uppercase">
        2025 Кибертроеборье · GG WP · Бомбардиро Крокодило чемпион
      </p>
    </footer>
  )
}

// ============================================================
// 🚀 App
// ============================================================
export default function App() {
  const [teams, setTeams]               = useState([])
  const [isOrganizer, setIsOrganizer]   = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [toasts, setToasts]             = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = genId()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }, [])

  useEffect(() => {
    async function load() {
      setLoadingTeams(true)
      try {
        const remote = await fetchTeamsFromSheet()
        setTeams(remote)
        lsSave(remote)
      } catch (err) {
        console.warn('Google Sheets недоступен:', err)
        const local = lsLoad()
        setTeams(local)
        if (local.length > 0) addToast(`Загружено из кеша (${local.length} команд)`, 'info')
      } finally {
        setLoadingTeams(false)
      }
    }
    load()
  }, [addToast])

  const handleTeamAdded = useCallback((team) => {
    setTeams((prev) => prev.find((t) => t.id === team.id) ? prev : [...prev, team])
  }, [])

  const handleKick = useCallback((id) => {
    setTeams((prev) => { const u = prev.filter((t) => t.id !== id); lsSave(u); return u })
    addToast('Команда кикнута.', 'success')
  }, [addToast])

  const handleOrganizerToggle = useCallback((val) => setIsOrganizer(val), [])

  return (
    <div className="bg-grid scanline-overlay min-h-screen">
      <Navbar />
      <main>
        {/* Герой: интерактивная canvas-анимация */}
        <HeroCanvas />

        {/* Разделитель */}
        <div className="neon-divider" />

        {/* Описание форматов турнира */}
        <FormatsSection />

        {/* Форма регистрации */}
        <RegistrationForm onTeamAdded={handleTeamAdded} addToast={addToast} />

        {/* Список команд */}
        <TeamsList
          teams={teams}
          isOrganizer={isOrganizer}
          onOrganizerToggle={handleOrganizerToggle}
          onKick={handleKick}
          loading={loadingTeams}
        />
      </main>
      <Footer />
      <Toast toasts={toasts} />
    </div>
  )
}
