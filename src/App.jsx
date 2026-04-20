import { useState, useEffect, useRef, useCallback } from 'react'

// ============================================================
// ⚙️  КОНФИГУРАЦИЯ — вставь сюда URL своего Google Apps Script
// ============================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw0eNND19ATEEP3bLxkcuxK1-LOMcCPOX3DjCX4lXQBcmD4OFqxLaYlnlwyEGl67dfY/exec'

// Ключ для LocalStorage резервной копии
const LS_KEY = 'clown-cup-teams'

// ============================================================
// 🔧 УТИЛИТЫ
// ============================================================

/** Загрузить команды из Google Таблицы */
async function fetchTeamsFromSheet() {
  const resp = await fetch(`${SCRIPT_URL}?action=getTeams`, { cache: 'no-store' })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  const data = await resp.json()
  if (!Array.isArray(data)) throw new Error('Неверный формат ответа')
  return data
}

/** Сохранить команду в Google Таблицу */
async function saveTeamToSheet(team) {
  const resp = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // нужно для CORS через Apps Script
    body: JSON.stringify({ action: 'addTeam', team }),
  })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  return await resp.json()
}

/** Удалить команду из Google Таблицы */
async function deleteTeamFromSheet(id) {
  const resp = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'deleteTeam', id }),
  })
  if (!resp.ok) throw new Error('HTTP ' + resp.status)
  return await resp.json()
}

/** LocalStorage — чтение */
function lsLoad() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || []
  } catch {
    return []
  }
}

/** LocalStorage — запись */
function lsSave(teams) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(teams))
  } catch {}
}

/** Генерация ID */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ============================================================
// 🍞 Toast-уведомления
// ============================================================
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-3 max-w-xs w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-enter pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl ${
            t.type === 'success'
              ? 'bg-green-950/80 border-green-500/40 text-green-300'
              : t.type === 'error'
              ? 'bg-red-950/80 border-red-500/40 text-red-300'
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
// 🏆 Hero Section
// ============================================================
function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center overflow-hidden pt-20 pb-16">
      {/* Декоративные пятна */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-900/20 rounded-full blur-3xl pointer-events-none" />

      {/* Мем-тег сверху */}
      <div className="meme-tag text-green-400 mb-4 tracking-widest">
        ⚡ NOT FOR SALE · 322 РУЛЯ НЕ ПРОДАЁТСЯ · GG WP · SKIBIDI ⚡
      </div>

      {/* Главная эмодзи */}
      <div className="float-anim text-7xl sm:text-8xl mb-6 select-none" aria-hidden>
        🏆
      </div>

      {/* Заголовок */}
      <h1 className="hero-title text-4xl sm:text-5xl lg:text-7xl font-black leading-tight mb-4 tracking-tight">
        <span className="text-gradient-green">КИБЕР</span>
        <span className="text-white">ТРОЕ</span>
        <span className="text-gradient-purple">БОРЬЕ</span>
      </h1>

      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-300 mb-8">
        Dota&nbsp;2 &nbsp;·&nbsp; CS2 &nbsp;·&nbsp;{' '}
        <span className="text-gradient-fire">Червячная Арена</span> 🐛
      </h2>

      {/* Описание форматов */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-10">
        <div className="team-card rounded-2xl p-4">
          <div className="game-badge badge-dota mb-3">🎮 Dota 2</div>
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="font-bold text-red-400">BO1 Captains Draft</span>
            <br />Рандомные герои.<br />Скрипт и удача решают.
          </p>
        </div>
        <div className="team-card rounded-2xl p-4">
          <div className="game-badge badge-cs2 mb-3">💥 CS2</div>
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="font-bold text-orange-400">BO1 Mirage / Inferno</span>
            <br />Карта по договорённости.<br />Blame the teammate.
          </p>
        </div>
        <div className="team-card rounded-2xl p-4">
          <div className="game-badge badge-worm mb-3">🐛 Wormix</div>
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="font-bold text-green-400">BO1 Дуэль на арене</span>
            <br />Проигравший кидает донат стримеру с песней{' '}
            <span className="text-yellow-400 font-bold">«Ко-ко-шнейне»</span> 🐔
          </p>
        </div>
      </div>

      {/* CTA кнопка */}
      <a
        href="#register"
        className="btn-glitch btn-main inline-block px-10 py-4 rounded-2xl text-black font-black text-xl uppercase tracking-widest"
        data-text="ЗАПИСАТЬ ПАТИ"
        style={{ background: 'linear-gradient(135deg, #00ff88, #00aaff)' }}
      >
        ЗАПИСАТЬ ПАТИ 🚀
      </a>

      {/* Easter eggs */}
      <p className="mt-8 text-xs text-gray-600 font-bold tracking-widest uppercase">
        Бомбардиро Крокодило одобряет · Тралалело Тралала · Итальянский брейнрот
      </p>

      {/* Стрелка вниз */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-600 animate-bounce text-2xl select-none">
        ↓
      </div>
    </section>
  )
}

// ============================================================
// 📝 Форма регистрации
// ============================================================
function RegistrationForm({ onTeamAdded, addToast }) {
  const [form, setForm] = useState({
    name: '',
    dota: '',
    cs2: '',
    wormix: '',
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.dota.trim() || !form.cs2.trim() || !form.wormix.trim()) {
      addToast('Заполни все поля, братан! 🤡', 'error')
      return
    }

    const team = {
      id: genId(),
      name: form.name.trim(),
      dota: form.dota.trim(),
      cs2: form.cs2.trim(),
      wormix: form.wormix.trim(),
      registeredAt: new Date().toISOString(),
    }

    setLoading(true)

    try {
      // Пробуем сохранить в Google Таблицу
      await saveTeamToSheet(team)
      addToast('Заявка улетела в штаб! ✈️ GG WP', 'success')
    } catch (err) {
      // Резервное сохранение в LocalStorage
      const backup = lsLoad()
      backup.push(team)
      lsSave(backup)
      addToast('Проблемы со связью, но мы всё запомнили локально 💾', 'error')
      console.warn('Google Sheets error:', err)
    }

    onTeamAdded(team)
    setForm({ name: '', dota: '', cs2: '', wormix: '' })
    setLoading(false)
  }

  const fields = [
    {
      name: 'name',
      label: 'Название команды',
      placeholder: 'Например: SkibidiGang322 💀',
      icon: '🏷️',
    },
    {
      name: 'dota',
      label: 'MMR в Dota 2',
      placeholder: 'Например: Древний 3 или 5000',
      icon: '🎮',
    },
    {
      name: 'cs2',
      label: 'ELO / Faceit в CS2',
      placeholder: 'Например: Gold Nova 2 или 1800',
      icon: '💥',
    },
    {
      name: 'wormix',
      label: 'Ник в третьей игре (Wormix)',
      placeholder: 'Например: WormSlayer9000',
      icon: '🐛',
    },
  ]

  return (
    <section id="register" className="py-20 px-4">
      <div className="max-w-xl mx-auto">
        {/* Заголовок секции */}
        <div className="text-center mb-10">
          <div className="meme-tag text-purple-400 mb-3">// РЕГИСТРАЦИЯ УЧАСТНИКОВ</div>
          <h2 className="text-3xl sm:text-4xl font-black">
            <span className="text-gradient-purple">Записать</span>{' '}
            <span className="text-white">Команду</span>
          </h2>
          <p className="text-gray-500 text-sm mt-2">Все поля обязательны. Слабаки не регистрируются.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="team-card rounded-3xl p-6 sm:p-8 space-y-5"
        >
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest">
                {f.icon} {f.label}
              </label>
              <input
                type="text"
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
                placeholder={f.placeholder}
                maxLength={80}
                className="neon-input w-full px-4 py-3 rounded-xl text-sm font-semibold"
                autoComplete="off"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="btn-glitch w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            data-text="ПОГНАЛИ 🚀"
            style={{
              background: loading
                ? 'rgba(0,255,136,0.4)'
                : 'linear-gradient(135deg, #00ff88, #00aaff)',
            }}
          >
            {loading ? '⏳ Отправляем...' : 'ПОГНАЛИ 🚀'}
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

  const handleKick = async () => {
    if (!window.confirm(`Кикнуть команду «${team.name}»? Безвозвратно! 💀`)) return
    setKicking(true)
    try {
      await deleteTeamFromSheet(team.id)
    } catch {
      // Если Google Sheet недоступен, просто удаляем локально
    }
    onKick(team.id)
  }

  const medals = ['🥇', '🥈', '🥉']
  const medal = medals[index] || `#${index + 1}`

  return (
    <div className="team-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Номер */}
      <div className="text-2xl font-black w-10 text-center flex-shrink-0 select-none">
        {medal}
      </div>

      {/* Данные команды */}
      <div className="flex-1 min-w-0">
        <h3 className="font-black text-lg text-white truncate mb-2">{team.name}</h3>
        <div className="flex flex-wrap gap-2">
          <span className="game-badge badge-dota">
            🎮 {team.dota}
          </span>
          <span className="game-badge badge-cs2">
            💥 {team.cs2}
          </span>
          <span className="game-badge badge-worm">
            🐛 {team.wormix}
          </span>
        </div>
      </div>

      {/* Дата + кик */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {team.registeredAt && (
          <span className="text-xs text-gray-600">
            {new Date(team.registeredAt).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        {isOrganizer && (
          <button
            onClick={handleKick}
            disabled={kicking}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-950/50 border border-red-500/30 text-red-400 hover:bg-red-900/50 hover:border-red-500/60 transition-all disabled:opacity-40"
          >
            {kicking ? '⏳' : '❌ Кикнуть'}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 📋 Список команд
// ============================================================
function TeamsList({ teams, isOrganizer, onOrganizerToggle, onKick, loading }) {
  const copyToClipboard = () => {
    if (!teams.length) return
    const header = 'Название\tDota 2 MMR\tCS2 ELO\tWormix ник\tДата'
    const rows = teams.map(
      (t) =>
        `${t.name}\t${t.dota}\t${t.cs2}\t${t.wormix}\t${
          t.registeredAt ? new Date(t.registeredAt).toLocaleString('ru-RU') : '—'
        }`
    )
    navigator.clipboard.writeText([header, ...rows].join('\n'))
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

        {/* Заголовок */}
        <div className="text-center mb-8">
          <div className="meme-tag text-green-400 mb-3">// ЗАРЕГИСТРИРОВАННЫЕ УЧАСТНИКИ</div>
          <h2 className="text-3xl sm:text-4xl font-black">
            <span className="text-gradient-green">Пати</span>{' '}
            <span className="text-white">в деле</span>{' '}
            <span className="count-anim">
              ({teams.length})
            </span>
          </h2>
        </div>

        {/* Инструменты */}
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

        {/* Режим организатора */}
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

        {/* Состояние загрузки */}
        {loading && (
          <div className="text-center text-gray-500 py-10 text-sm font-bold animate-pulse">
            ⏳ Загружаем команды из штаба...
          </div>
        )}

        {/* Пустой стейт */}
        {!loading && teams.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 select-none">😭</div>
            <p className="text-gray-500 font-bold text-lg">Пока никого нет.</p>
            <p className="text-gray-600 text-sm mt-1">
              Будь первым! Или позови скибиди-тойлет.
            </p>
          </div>
        )}

        {/* Список */}
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
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-black/70 backdrop-blur-md border-b border-white/5' : ''
      }`}
    >
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
        © 2025 Кибертроеборье · Этот сайт не продаётся за 322 рубля · GG WP · Бомбардиро Крокодило чемпион
      </p>
    </footer>
  )
}

// ============================================================
// 🎯 APP — главный компонент
// ============================================================
export default function App() {
  const [teams, setTeams]           = useState([])
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [toasts, setToasts]         = useState([])

  // Добавление toast-уведомления
  const addToast = useCallback((message, type = 'info') => {
    const id = genId()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }, [])

  // Загрузка команд при монтировании
  useEffect(() => {
    async function load() {
      setLoadingTeams(true)
      try {
        const remote = await fetchTeamsFromSheet()
        setTeams(remote)
        // Синхронизируем LocalStorage
        lsSave(remote)
      } catch (err) {
        console.warn('Не удалось загрузить из Google Sheets, используем LocalStorage:', err)
        const local = lsLoad()
        setTeams(local)
        if (local.length > 0) {
          addToast(`Загружено из локального кэша (${local.length} команд) 💾`, 'info')
        }
      } finally {
        setLoadingTeams(false)
      }
    }
    load()
  }, [addToast])

  // Переключить режим организатора
  const handleOrganizerToggle = useCallback((val) => setIsOrganizer(val), [])

  // Добавить команду в список
  const handleTeamAdded = useCallback((team) => {
    setTeams((prev) => {
      // Не дублируем, если уже есть (редкий кейс)
      if (prev.find((t) => t.id === team.id)) return prev
      return [...prev, team]
    })
  }, [])

  // Кикнуть команду
  const handleKick = useCallback((id) => {
    setTeams((prev) => {
      const updated = prev.filter((t) => t.id !== id)
      lsSave(updated)
      return updated
    })
    addToast('Команда кикнута. Скибиди-баст. 💀', 'success')
  }, [addToast])

  return (
    <div className="bg-grid scanline-overlay min-h-screen">
      <Navbar />

      <main>
        <HeroSection />

        <RegistrationForm
          onTeamAdded={handleTeamAdded}
          addToast={addToast}
        />

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
