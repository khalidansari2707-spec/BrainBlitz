import React, { useState, useEffect, useCallback } from 'react'
import GameScreen from './GameScreen'

// ─── Subject definitions with themes ────────────────────────────────────────
const subjects = [
  { id: 'bio',  name: 'Biology',           icon: '🧬', color: '#22c55e', glow: 'rgba(34,197,94,0.3)',   bg: 'from-green-900/50 to-green-800/20',  border: 'border-green-500/40' },
  { id: 'chem', name: 'Chemistry',         icon: '⚗️', color: '#f97316', glow: 'rgba(249,115,22,0.3)',  bg: 'from-orange-900/50 to-orange-800/20', border: 'border-orange-500/40' },
  { id: 'phys', name: 'Physics',           icon: '⚡', color: '#3b82f6', glow: 'rgba(59,130,246,0.3)', bg: 'from-blue-900/50 to-blue-800/20',     border: 'border-blue-500/40' },
  { id: 'os',   name: 'Operating Systems', icon: '💻', color: '#a855f7', glow: 'rgba(168,85,247,0.3)', bg: 'from-purple-900/50 to-purple-800/20', border: 'border-purple-500/40' },
  { id: 'dbms', name: 'DBMS',              icon: '🗄️', color: '#ef4444', glow: 'rgba(239,68,68,0.3)',   bg: 'from-red-900/50 to-red-800/20',       border: 'border-red-500/40' },
  { id: 'cn',   name: 'Computer Networks', icon: '🌐', color: '#64748b', glow: 'rgba(100,116,139,0.3)', bg: 'from-slate-900/50 to-slate-800/20',   border: 'border-slate-500/40' },
  { id: 'se',   name: 'Software Engg.',    icon: '🏗️', color: '#d97706', glow: 'rgba(217,119,6,0.3)',   bg: 'from-amber-900/50 to-amber-800/20',   border: 'border-amber-500/40' },
]

const modes = [
  { id: 'label_rush',    name: 'Label Rush',     icon: '🏷️', desc: 'Place labels onto diagram zones' },
  { id: 'sequence_snap', name: 'Sequence Snap',  icon: '🔢', desc: 'Reorder steps in correct sequence' },
  { id: 'spot_fault',    name: 'Spot the Fault', icon: '🔍', desc: 'Find incorrect statements' },
  { id: 'match_links',   name: 'Match Links',    icon: '🔗', desc: 'Connect matching pairs together' },
  { id: 'interpret',     name: 'Interpret Mode', icon: '💡', desc: 'Answer MCQs based on diagrams' },
  { id: 'speed_blitz',   name: 'Speed Blitz',    icon: '⚡', desc: 'Rapid-fire questions in 30 seconds!', isNew: true },
]

// ─── XP / Level System ──────────────────────────────────────────────────────
const LEVELS = [
  { level: 1,  name: 'Novice',        xpRequired: 0,    badge: '🌱' },
  { level: 2,  name: 'Explorer',      xpRequired: 500,  badge: '🔭' },
  { level: 3,  name: 'Apprentice',    xpRequired: 1200, badge: '📚' },
  { level: 4,  name: 'Scholar',       xpRequired: 2500, badge: '🎓' },
  { level: 5,  name: 'Expert',        xpRequired: 4500, badge: '🧪' },
  { level: 6,  name: 'Master',        xpRequired: 7000, badge: '⚗️' },
  { level: 7,  name: 'Grandmaster',   xpRequired: 10000,badge: '🏆' },
  { level: 8,  name: 'Champion',      xpRequired: 14000,badge: '👑' },
  { level: 9,  name: 'Legend',        xpRequired: 19000,badge: '🌟' },
  { level: 10, name: 'Diagram Master',xpRequired: 25000,badge: '🎯' },
]

function getLevelInfo(totalXP) {
  let current = LEVELS[0]
  let next = LEVELS[1]
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXP >= LEVELS[i].xpRequired) {
      current = LEVELS[i]
      next = LEVELS[i + 1] || null
    }
  }
  const xpIntoLevel = totalXP - current.xpRequired
  const xpNeeded = next ? next.xpRequired - current.xpRequired : 1
  const pct = next ? Math.min((xpIntoLevel / xpNeeded) * 100, 100) : 100
  return { current, next, xpIntoLevel, xpNeeded, pct }
}

// ─── Daily Streak Helpers ───────────────────────────────────────────────────
function getTodayKey() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function updateStreak(streakData) {
  const today = getTodayKey()
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (streakData.lastPlayed === today) return streakData // already played today
  if (streakData.lastPlayed === yesterday) {
    return { ...streakData, count: streakData.count + 1, lastPlayed: today }
  }
  return { count: 1, lastPlayed: today } // streak broken
}

// ─── Storage Helpers ────────────────────────────────────────────────────────
function loadStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback }
  catch { return fallback }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ─── PLAYER AVATARS ─────────────────────────────────────────────────────────
const AVATARS = ['🧑‍💻', '👩‍🔬', '👨‍🏫', '🧑‍🚀', '👩‍💼', '🦸', '🧙', '🥷', '👾', '🤖', '🦊', '🐉']

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
function App() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [selectedMode, setSelectedMode]     = useState(null)

  // Persistent state
  const [highScores, setHighScores] = useState(() => loadStorage('duelHighScores', {}))
  const [totalXP, setTotalXP]       = useState(() => loadStorage('duelTotalXP', 0))
  const [streak, setStreak]         = useState(() => loadStorage('duelStreak', { count: 0, lastPlayed: null }))
  const [playerName, setPlayerName] = useState(() => loadStorage('duelPlayerName', ''))
  const [playerAvatar, setPlayerAvatar] = useState(() => loadStorage('duelPlayerAvatar', '🧑‍💻'))
  const [leaderboard, setLeaderboard] = useState(() => loadStorage('duelLeaderboard', []))
  const [gameHistory, setGameHistory] = useState(() => loadStorage('duelGameHistory', []))
  const [soundEnabled, setSoundEnabled] = useState(() => loadStorage('duelSound', true))
  const [showLevelUp, setShowLevelUp] = useState(null) // level info to show

  // First-time player setup
  const needsSetup = !playerName

  const levelInfo = getLevelInfo(totalXP)

  const saveHighScore = useCallback((subject, mode, score, xpEarned = 0) => {
    // Update high score
    const key = `${subject}-${mode}`
    const current = highScores[key] || 0
    let updated = highScores
    if (score > current) {
      updated = { ...highScores, [key]: score }
      setHighScores(updated)
      saveStorage('duelHighScores', updated)
    }

    // Update XP
    const oldLevel = getLevelInfo(totalXP).current.level
    const newTotalXP = totalXP + xpEarned
    setTotalXP(newTotalXP)
    saveStorage('duelTotalXP', newTotalXP)
    const newLevel = getLevelInfo(newTotalXP).current.level
    if (newLevel > oldLevel) {
      setShowLevelUp(getLevelInfo(newTotalXP).current)
    }

    // Update streak
    const newStreak = updateStreak(streak)
    setStreak(newStreak)
    saveStorage('duelStreak', newStreak)

    // Update leaderboard
    const entry = { name: playerName || 'Anonymous', avatar: playerAvatar, score, subject, mode, date: getTodayKey() }
    const newBoard = [entry, ...leaderboard].sort((a, b) => b.score - a.score).slice(0, 20)
    setLeaderboard(newBoard)
    saveStorage('duelLeaderboard', newBoard)

    // Update game history for stats
    const historyEntry = { subject, mode, score, correct: 0, total: 0, date: getTodayKey() }
    const newHistory = [historyEntry, ...gameHistory].slice(0, 100)
    setGameHistory(newHistory)
    saveStorage('duelGameHistory', newHistory)
  }, [totalXP, highScores, streak, playerName, playerAvatar, leaderboard, gameHistory])

  const updateGameHistory = useCallback((subject, mode, correct, total) => {
    const entry = { subject, mode, correct, total, date: getTodayKey() }
    const newHistory = [entry, ...gameHistory].slice(0, 100)
    setGameHistory(newHistory)
    saveStorage('duelGameHistory', newHistory)
  }, [gameHistory])

  const handleSetupComplete = (name, avatar) => {
    setPlayerName(name)
    setPlayerAvatar(avatar)
    saveStorage('duelPlayerName', name)
    saveStorage('duelPlayerAvatar', avatar)
    setCurrentScreen('home')
  }

  // Screen router
  if (needsSetup) {
    return <SetupScreen onComplete={handleSetupComplete} />
  }

  return (
    <div className="min-h-screen bg-primary text-white font-sans">
      {/* Level Up Overlay */}
      {showLevelUp && (
        <LevelUpOverlay levelInfo={showLevelUp} onClose={() => setShowLevelUp(null)} />
      )}

      {currentScreen === 'home' && (
        <HomeScreen
          setCurrentScreen={setCurrentScreen}
          soundEnabled={soundEnabled}
          setSoundEnabled={(v) => { setSoundEnabled(v); saveStorage('duelSound', v) }}
          highScores={highScores}
          totalXP={totalXP}
          levelInfo={levelInfo}
          streak={streak}
          playerName={playerName}
          playerAvatar={playerAvatar}
        />
      )}
      {currentScreen === 'select' && (
        <SubjectModeScreen
          subjects={subjects}
          modes={modes}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          selectedMode={selectedMode}
          setSelectedMode={setSelectedMode}
          setCurrentScreen={setCurrentScreen}
          highScores={highScores}
        />
      )}
      {currentScreen === 'game' && selectedSubject && selectedMode && (
        <GameScreen
          selectedSubject={selectedSubject}
          selectedMode={selectedMode}
          setCurrentScreen={setCurrentScreen}
          soundEnabled={soundEnabled}
          saveHighScore={saveHighScore}
          updateGameHistory={updateGameHistory}
          playerName={playerName}
          playerAvatar={playerAvatar}
        />
      )}
      {currentScreen === 'leaderboard' && (
        <LeaderboardScreen leaderboard={leaderboard} setCurrentScreen={setCurrentScreen} playerName={playerName} />
      )}
      {currentScreen === 'stats' && (
        <StatsScreen gameHistory={gameHistory} highScores={highScores} subjects={subjects} modes={modes} setCurrentScreen={setCurrentScreen} totalXP={totalXP} levelInfo={levelInfo} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP SCREEN (First Time)
// ═══════════════════════════════════════════════════════════════════════════
function SetupScreen({ onComplete }) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('🧑‍💻')
  const [step, setStep] = useState(0) // 0=name, 1=avatar

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3 animate-float">🎯</div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-accent via-pink-400 to-purple-400 bg-clip-text text-transparent">
            Diagram Duel
          </h1>
          <p className="text-white/50 mt-2">Let's set up your profile first!</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
          {step === 0 ? (
            <div>
              <h2 className="text-xl font-bold mb-1">What's your name?</h2>
              <p className="text-white/40 text-sm mb-4">This will show on the leaderboard</p>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-accent focus:bg-white/15 transition text-lg"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(1)}
              />
              <button
                onClick={() => name.trim() && setStep(1)}
                disabled={!name.trim()}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-accent to-pink-600 text-white font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Next →
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold mb-1">Choose your avatar</h2>
              <p className="text-white/40 text-sm mb-4">Pick an emoji that represents you</p>
              <div className="grid grid-cols-6 gap-2 mb-4">
                {AVATARS.map(av => (
                  <button
                    key={av}
                    onClick={() => setAvatar(av)}
                    className={`text-3xl p-2 rounded-xl transition-all ${avatar === av ? 'bg-accent/30 border-2 border-accent scale-110' : 'bg-white/5 border-2 border-transparent hover:bg-white/15 hover:scale-110'}`}
                  >
                    {av}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
                <span className="text-3xl">{avatar}</span>
                <div>
                  <div className="font-semibold">{name}</div>
                  <div className="text-xs text-white/40">Level 1 Novice 🌱</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-medium transition">← Back</button>
                <button
                  onClick={() => onComplete(name.trim(), avatar)}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-accent to-pink-600 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  ⚔️ Start!
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LEVEL UP OVERLAY
// ═══════════════════════════════════════════════════════════════════════════
function LevelUpOverlay({ levelInfo, onClose }) {
  useEffect(() => {
    const tid = setTimeout(onClose, 3500)
    return () => clearTimeout(tid)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="text-center animate-level-up">
        <div className="text-8xl mb-3">{levelInfo.badge}</div>
        <div className="text-2xl font-black text-yellow-400 mb-1">LEVEL UP!</div>
        <div className="text-4xl font-black text-white mb-2">Level {levelInfo.level}</div>
        <div className="text-xl text-white/70">{levelInfo.name}</div>
        <div className="mt-4 text-white/40 text-sm">Tap to continue</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function HomeScreen({ setCurrentScreen, soundEnabled, setSoundEnabled, highScores, totalXP, levelInfo, streak, playerName, playerAvatar }) {
  const [visible, setVisible] = useState(false)
  const totalScores = Object.values(highScores)
  const bestScore = totalScores.length ? Math.max(...totalScores) : 0
  const totalGames = totalScores.length

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-2xl animate-pulse" />
      </div>

      <div className={`text-center max-w-sm w-full relative z-10 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Player Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 mb-6 text-left">
          <div className="text-4xl">{playerAvatar}</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{playerName}</div>
            <div className="text-xs text-white/50">{levelInfo.current.badge} {levelInfo.current.name} • Lv.{levelInfo.current.level}</div>
            {/* XP Bar */}
            <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all duration-700"
                style={{ width: `${levelInfo.pct}%` }}
              />
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">{levelInfo.xpIntoLevel} / {levelInfo.xpNeeded} XP</div>
          </div>
          {streak.count >= 2 && (
            <div className="flex flex-col items-center bg-orange-500/20 border border-orange-500/40 rounded-xl px-2 py-1">
              <span className="text-lg">🔥</span>
              <span className="text-orange-300 text-xs font-bold">{streak.count}</span>
            </div>
          )}
        </div>

        {/* Logo */}
        <div className="mb-4 animate-float">
          <div className="text-6xl mb-2">🎯</div>
          <h1 className="text-5xl font-black bg-gradient-to-r from-accent via-pink-400 to-purple-400 bg-clip-text text-transparent">
            Diagram Duel
          </h1>
          <p className="text-base text-white/50 mt-2 font-light">
            Master diagrams. Challenge yourself. Learn faster.
          </p>
        </div>

        {/* Quick Stats */}
        {totalGames > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-lg font-black text-yellow-400">⭐ {bestScore}</div>
              <div className="text-[10px] text-white/40">Best Score</div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-lg font-black text-blue-400">{totalXP.toLocaleString()}</div>
              <div className="text-[10px] text-white/40">Total XP</div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-lg font-black text-green-400">{totalGames}</div>
              <div className="text-[10px] text-white/40">Games Won</div>
            </div>
          </div>
        )}

        {/* Mode Preview */}
        <div className="grid grid-cols-6 gap-1.5 mb-6">
          {['🏷️', '🔢', '🔍', '🔗', '💡', '⚡'].map((icon, i) => (
            <div key={i} className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-200 ${i === 5 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/10'}`}>
              <span className="text-xl">{icon}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => setCurrentScreen('select')}
          className="relative w-full py-4 text-xl font-bold rounded-2xl text-white overflow-hidden group transition-all duration-300 hover:scale-105 active:scale-95 mb-3"
          style={{
            background: 'linear-gradient(135deg, #e94560, #c62a47)',
            boxShadow: '0 0 30px rgba(233,69,96,0.4), 0 4px 15px rgba(0,0,0,0.3)',
          }}
        >
          <span className="relative z-10">⚔️ Start Duel</span>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Secondary Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setCurrentScreen('leaderboard')}
            className="py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-medium"
          >
            🏆 Leaderboard
          </button>
          <button
            onClick={() => setCurrentScreen('stats')}
            className="py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-medium"
          >
            📊 My Stats
          </button>
        </div>

        {/* Sound */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-white/30 hover:text-white/60 text-sm transition-colors"
        >
          {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBJECT + MODE SELECT SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function SubjectModeScreen({ subjects, modes, selectedSubject, setSelectedSubject, selectedMode, setSelectedMode, setCurrentScreen, highScores }) {
  const [visible, setVisible] = useState(false)
  const canStart = selectedSubject && selectedMode

  useEffect(() => {
    setTimeout(() => setVisible(true), 50)
  }, [])

  const theme = selectedSubject
    ? { color: selectedSubject.color, glow: selectedSubject.glow }
    : { color: '#e94560', glow: 'rgba(233,69,96,0.3)' }

  return (
    <div className="min-h-screen p-6 relative overflow-hidden">
      <button
        onClick={() => setCurrentScreen('home')}
        className="fixed top-5 left-5 z-50 px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all text-sm"
      >
        ← Back
      </button>

      <div className={`max-w-lg mx-auto pt-12 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <h2 className="text-3xl font-black text-center mb-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          Choose Your Challenge
        </h2>
        <p className="text-center text-white/40 mb-6 text-sm">Select a subject and game mode to begin</p>

        {/* Subjects */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">📚 Subject</h3>
          <div className="grid grid-cols-4 gap-2">
            {subjects.map((subject) => {
              const isSelected = selectedSubject?.id === subject.id
              return (
                <button
                  key={subject.id}
                  onClick={() => setSelectedSubject(subject)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 hover:scale-105 active:scale-95 ${
                    isSelected
                      ? `border-2 bg-white/10 scale-105`
                      : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                  }`}
                  style={isSelected ? {
                    borderColor: subject.color,
                    boxShadow: `0 0 15px ${subject.glow}`,
                  } : {}}
                >
                  <span className="text-2xl">{subject.icon}</span>
                  <span className={`text-[10px] font-medium text-center leading-tight ${isSelected ? 'text-white' : 'text-white/60'}`}>
                    {subject.name}
                  </span>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subject.color }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Modes */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">🎮 Mode</h3>
          <div className="flex flex-col gap-2">
            {modes.map((mode) => {
              const isSelected = selectedMode?.id === mode.id
              const scoreKey = selectedSubject ? `${selectedSubject.id}-${mode.id}` : null
              const score = scoreKey ? highScores[scoreKey] : null
              return (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode)}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                    isSelected
                      ? 'border-accent bg-accent/15 shadow-lg shadow-accent/20'
                      : mode.isNew
                      ? 'border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <span className="text-2xl">{mode.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm flex items-center gap-2 ${isSelected ? 'text-white' : 'text-white/80'}`}>
                      {mode.name}
                      {mode.isNew && <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded-full font-bold">NEW</span>}
                    </div>
                    <div className="text-xs text-white/40 truncate">{mode.desc}</div>
                  </div>
                  {score && <div className="text-xs text-yellow-400 font-bold flex-shrink-0">🏆 {score}</div>}
                  {isSelected && <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={() => canStart && setCurrentScreen('game')}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl text-lg font-bold transition-all duration-300 ${
            canStart
              ? 'text-white hover:scale-[1.02] active:scale-[0.98] shadow-lg'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
          style={canStart && selectedSubject ? {
            background: `linear-gradient(135deg, ${selectedSubject.color}, ${selectedSubject.color}99)`,
            boxShadow: `0 0 20px ${selectedSubject.glow}`,
          } : {}}
        >
          {canStart
            ? `⚔️ Start ${selectedMode?.name} — ${selectedSubject?.name}`
            : '⬆️ Select Subject & Mode to Continue'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function LeaderboardScreen({ leaderboard, setCurrentScreen, playerName }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 50) }, [])

  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600']
  const medals = ['🥇', '🥈', '🥉']

  const subjectMap = { bio: '🧬', chem: '⚗️', phys: '⚡', os: '💻', dbms: '🗄️', cn: '🌐', se: '🏗️' }
  const modeMap = { label_rush: '🏷️', sequence_snap: '🔢', spot_fault: '🔍', match_links: '🔗', interpret: '💡', speed_blitz: '⚡' }

  return (
    <div className="min-h-screen p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      <button onClick={() => setCurrentScreen('home')} className="fixed top-5 left-5 z-50 px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm">
        ← Back
      </button>

      <div className={`max-w-lg mx-auto pt-12 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Leaderboard</h2>
          <p className="text-white/40 text-sm mt-1">Top scores from your sessions</p>
        </div>

        {leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-white/40">Play a game to get on the leaderboard!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.map((entry, i) => {
              const isYou = entry.name === playerName
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    i < 3
                      ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30'
                      : isYou
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <span className="text-lg w-8 text-center font-black">
                    {i < 3 ? medals[i] : <span className="text-white/40">#{i + 1}</span>}
                  </span>
                  <span className="text-2xl">{entry.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm flex items-center gap-2 ${isYou ? 'text-accent' : ''}`}>
                      {entry.name}
                      {isYou && <span className="text-[10px] bg-accent/30 text-accent px-1.5 py-0.5 rounded-full">You</span>}
                    </div>
                    <div className="text-xs text-white/30">
                      {subjectMap[entry.subject] || '📚'} {modeMap[entry.mode] || '🎮'} • {entry.date}
                    </div>
                  </div>
                  <div className={`text-lg font-black ${i < 3 ? medalColors[i] : 'text-white/70'}`}>
                    ⭐ {entry.score}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function StatsScreen({ gameHistory, highScores, subjects, modes, setCurrentScreen, totalXP, levelInfo }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 50) }, [])

  // Compute per-subject stats from highScores keys
  const subjectStats = subjects.map(subject => {
    const subjectScores = Object.entries(highScores)
      .filter(([key]) => key.startsWith(subject.id + '-'))
      .map(([, v]) => v)
    const bestScore = subjectScores.length ? Math.max(...subjectScores) : 0
    const gamesPlayed = subjectScores.length
    return { ...subject, bestScore, gamesPlayed }
  }).filter(s => s.gamesPlayed > 0)

  const totalGames = Object.keys(highScores).length
  const bestEver = totalGames ? Math.max(...Object.values(highScores)) : 0
  const strongestSubject = subjectStats.sort((a, b) => b.bestScore - a.bestScore)[0]

  return (
    <div className="min-h-screen p-6 relative overflow-hidden">
      <button onClick={() => setCurrentScreen('home')} className="fixed top-5 left-5 z-50 px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm">
        ← Back
      </button>

      <div className={`max-w-lg mx-auto pt-12 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">📊</div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">My Stats</h2>
          <p className="text-white/40 text-sm mt-1">Your learning journey so far</p>
        </div>

        {/* XP + Level card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-2xl font-black text-yellow-400">{levelInfo.current.badge} {levelInfo.current.name}</div>
              <div className="text-white/50 text-sm">Level {levelInfo.current.level} • {totalXP.toLocaleString()} XP total</div>
            </div>
            {levelInfo.next && <div className="text-white/30 text-xs text-right">Next: {levelInfo.next.badge}<br/>{levelInfo.next.name}</div>}
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all duration-700" style={{ width: `${levelInfo.pct}%` }} />
          </div>
          <div className="text-xs text-white/30 mt-1">{levelInfo.xpIntoLevel} / {levelInfo.xpNeeded} XP to next level</div>
        </div>

        {/* Overview */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-2xl font-black text-green-400">{totalGames}</div>
            <div className="text-xs text-white/40 mt-1">Modes Completed</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-2xl font-black text-yellow-400">⭐ {bestEver}</div>
            <div className="text-xs text-white/40 mt-1">Best Ever Score</div>
          </div>
        </div>

        {/* Strongest subject */}
        {strongestSubject && (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4 flex items-center gap-3">
            <span className="text-3xl">{strongestSubject.icon}</span>
            <div>
              <div className="text-sm font-bold text-green-400">💪 Strongest Subject</div>
              <div className="font-semibold">{strongestSubject.name}</div>
              <div className="text-xs text-white/40">Best Score: {strongestSubject.bestScore}</div>
            </div>
          </div>
        )}

        {/* Per-subject breakdown */}
        {subjectStats.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Subject Breakdown</h3>
            <div className="flex flex-col gap-2">
              {subjectStats.map(subject => (
                <div key={subject.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-2xl">{subject.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{subject.name}</div>
                    <div className="text-xs text-white/40">{subject.gamesPlayed} mode{subject.gamesPlayed !== 1 ? 's' : ''} played</div>
                  </div>
                  <div className="text-yellow-400 font-bold text-sm">⭐ {subject.bestScore}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalGames === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🎮</div>
            <p className="text-white/40">Play some games to see your stats!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App