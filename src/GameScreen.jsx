import React, { useState, useEffect, useCallback, useRef } from 'react'
import diagrams from './diagrams/index.js'

// ─── Sound effects via Web Audio API ───────────────────────────────────────
function useSound(enabled) {
  const ctx = useRef(null)

  const getCtx = () => {
    if (!ctx.current) {
      ctx.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return ctx.current
  }

  const play = useCallback((type) => {
    if (!enabled) return
    try {
      const ac = getCtx()
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.connect(gain)
      gain.connect(ac.destination)

      if (type === 'correct') {
        osc.frequency.setValueAtTime(523, ac.currentTime)
        osc.frequency.setValueAtTime(659, ac.currentTime + 0.1)
        osc.frequency.setValueAtTime(784, ac.currentTime + 0.2)
        gain.gain.setValueAtTime(0.3, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4)
        osc.start(ac.currentTime)
        osc.stop(ac.currentTime + 0.4)
      } else if (type === 'wrong') {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(200, ac.currentTime)
        osc.frequency.setValueAtTime(150, ac.currentTime + 0.15)
        gain.gain.setValueAtTime(0.2, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
        osc.start(ac.currentTime)
        osc.stop(ac.currentTime + 0.3)
      } else if (type === 'click') {
        osc.frequency.setValueAtTime(800, ac.currentTime)
        gain.gain.setValueAtTime(0.1, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05)
        osc.start(ac.currentTime)
        osc.stop(ac.currentTime + 0.05)
      } else if (type === 'win') {
        const notes = [523, 659, 784, 1047]
        notes.forEach((freq, i) => {
          const o2 = ac.createOscillator()
          const g2 = ac.createGain()
          o2.connect(g2)
          g2.connect(ac.destination)
          o2.frequency.value = freq
          g2.gain.setValueAtTime(0.2, ac.currentTime + i * 0.1)
          g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.1 + 0.3)
          o2.start(ac.currentTime + i * 0.1)
          o2.stop(ac.currentTime + i * 0.1 + 0.3)
        })
      } else if (type === 'blitz') {
        // rapid beep for blitz
        osc.type = 'square'
        osc.frequency.setValueAtTime(1000, ac.currentTime)
        gain.gain.setValueAtTime(0.08, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06)
        osc.start(ac.currentTime)
        osc.stop(ac.currentTime + 0.06)
      } else if (type === 'shield') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(400, ac.currentTime)
        osc.frequency.setValueAtTime(600, ac.currentTime + 0.1)
        gain.gain.setValueAtTime(0.2, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
        osc.start(ac.currentTime)
        osc.stop(ac.currentTime + 0.3)
      }
    } catch {}
  }, [enabled])

  return play
}

// ─── Confetti ───────────────────────────────────────────────────────────────
async function fireConfetti() {
  try {
    const { default: confetti } = await import('canvas-confetti')
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#e94560', '#ff7eb3', '#45b7d1', '#ffd700'] })
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { x: 0.2, y: 0.7 } }), 300)
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { x: 0.8, y: 0.7 } }), 500)
  } catch {}
}

// ─── Share Score Card ────────────────────────────────────────────────────────
function shareScore({ score, subject, mode, accuracy, streak }) {
  const subjectEmojis = { bio: '🧬', chem: '⚗️', phys: '⚡', os: '💻', dbms: '🗄️', cn: '🌐', se: '🏗️' }
  const modeNames = { label_rush: 'Label Rush', sequence_snap: 'Sequence Snap', spot_fault: 'Spot the Fault', match_links: 'Match Links', interpret: 'Interpret Mode', speed_blitz: 'Speed Blitz' }
  const grade = accuracy >= 90 ? 'S 🏆' : accuracy >= 70 ? 'A 🎉' : accuracy >= 50 ? 'B 👍' : 'C 💪'
  const text = `🎯 Diagram Duel\n${subjectEmojis[subject] || '📚'} ${modeNames[mode] || mode}\n⭐ Score: ${score} | Grade: ${grade}\n🎯 Accuracy: ${accuracy}%${streak > 1 ? ` | 🔥 ${streak}-day streak` : ''}\nPlay at Diagram Duel!`
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
    return true
  }
  return false
}

// ─── XP Calculation ──────────────────────────────────────────────────────────
function calcXP(score, accuracy, mode) {
  const base = Math.floor(score / 10)
  const accuracyBonus = accuracy >= 90 ? 50 : accuracy >= 70 ? 30 : accuracy >= 50 ? 15 : 0
  const modeBonus = mode === 'speed_blitz' ? 30 : mode === 'interpret' ? 20 : 10
  return Math.max(base + accuracyBonus + modeBonus, 5)
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GAME SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function GameScreen({ selectedSubject, selectedMode, setCurrentScreen, soundEnabled, saveHighScore, updateGameHistory, playerName, playerAvatar }) {
  const play = useSound(soundEnabled)

  const diagramData = diagrams.find(
    (d) => d.subject === selectedSubject.id && d.mode === selectedMode.id
  )

  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(diagramData?.timeLimit || 60)
  const [isGameOver, setIsGameOver] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [glowZone, setGlowZone] = useState(null)
  const [frozenUntil, setFrozenUntil] = useState(null)
  const [shieldActive, setShieldActive] = useState(false)
  const [doubleXPActive, setDoubleXPActive] = useState(false)
  const [doubleXPUntil, setDoubleXPUntil] = useState(null)
  const [powerUpsUsed, setPowerUpsUsed] = useState({ freeze: false, fiftyFifty: false, glow: false, shield: false, doubleXP: false })
  const [gameKey, setGameKey] = useState(0)
  const [shareCopied, setShareCopied] = useState(false)
  const [wrongAnswers, setWrongAnswers] = useState([]) // for flashcard review

  const wrongCountRef = useRef(0)
  const correctCountRef = useRef(0)
  const scoreRef = useRef(0)

  // Timer
  useEffect(() => {
    if (isGameOver || showResult) return
    if (timeLeft <= 0) { endGame(false); return }
    const isFrozen = frozenUntil && Date.now() < frozenUntil
    if (isFrozen) return
    const tid = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(tid)
  }, [timeLeft, isGameOver, showResult, frozenUntil])

  // Track doubleXP expiry
  useEffect(() => {
    if (!doubleXPUntil) return
    if (Date.now() >= doubleXPUntil) { setDoubleXPActive(false); return }
    const tid = setTimeout(() => setDoubleXPActive(false), doubleXPUntil - Date.now())
    return () => clearTimeout(tid)
  }, [doubleXPUntil])

  const isDoubleXP = doubleXPActive && doubleXPUntil && Date.now() < doubleXPUntil

  const addScore = (pts, comboBonus = true) => {
    let multiplier = 1
    if (comboBonus && combo >= 2) multiplier *= Math.min(combo, 5)
    if (isDoubleXP) multiplier *= 2
    const earned = pts * multiplier
    setScore(s => { scoreRef.current = s + earned; return s + earned })
    return earned
  }

  const onCorrect = useCallback((pts = 100) => {
    play('correct')
    setCombo(c => c + 1)
    setCorrectCount(c => { correctCountRef.current = c + 1; return c + 1 })
    addScore(pts)
  }, [combo, play, isDoubleXP])

  const onWrong = useCallback((wrongInfo = null) => {
    if (shieldActive) {
      play('shield')
      setShieldActive(false)
      return // block the penalty!
    }
    play('wrong')
    setCombo(0)
    setWrongCount(w => { wrongCountRef.current = w + 1; return w + 1 })
    setScore(s => { scoreRef.current = Math.max(0, s - 30); return Math.max(0, s - 30) })
    if (wrongInfo) setWrongAnswers(prev => [...prev, wrongInfo])
  }, [play, shieldActive])

  const endGame = useCallback((won) => {
    setIsGameOver(true)
    setTimeout(() => {
      setShowResult(true)
      if (won) {
        fireConfetti()
        play('win')
      }
      const finalScore = scoreRef.current
      const total = diagramData?.labels?.length || diagramData?.steps?.length || diagramData?.items?.length || diagramData?.leftItems?.length || diagramData?.questions?.length || 1
      const accuracy = Math.round((correctCountRef.current / Math.max(total, 1)) * 100)
      const xpEarned = calcXP(finalScore, accuracy, selectedMode.id)
      if (saveHighScore && diagramData) {
        saveHighScore(selectedSubject.id, selectedMode.id, finalScore, xpEarned)
      }
      if (updateGameHistory) {
        updateGameHistory(selectedSubject.id, selectedMode.id, correctCountRef.current, total)
      }
    }, 500)
  }, [play, saveHighScore, updateGameHistory, selectedSubject, selectedMode, diagramData])

  const restart = () => {
    setScore(0); setCombo(0)
    setTimeLeft(diagramData?.timeLimit || 60)
    setIsGameOver(false); setShowResult(false)
    setCorrectCount(0); setWrongCount(0)
    setGlowZone(null); setFrozenUntil(null)
    setShieldActive(false); setDoubleXPActive(false); setDoubleXPUntil(null)
    setPowerUpsUsed({ freeze: false, fiftyFifty: false, glow: false, shield: false, doubleXP: false })
    setShareCopied(false); setWrongAnswers([])
    wrongCountRef.current = 0; correctCountRef.current = 0; scoreRef.current = 0
    setGameKey(k => k + 1)
  }

  const usePowerUp = (type) => {
    if (powerUpsUsed[type]) return
    play('click')
    setPowerUpsUsed(p => ({ ...p, [type]: true }))
    if (type === 'freeze') {
      setFrozenUntil(Date.now() + 10000)
    } else if (type === 'glow') {
      if (diagramData?.zones?.length > 0) {
        const firstEmpty = diagramData.zones[0]?.id
        setGlowZone(firstEmpty)
        setTimeout(() => setGlowZone(null), 4000)
      }
    } else if (type === 'shield') {
      play('shield')
      setShieldActive(true)
    } else if (type === 'doubleXP') {
      setDoubleXPActive(true)
      setDoubleXPUntil(Date.now() + 20000)
    }
  }

  const timerPct = (timeLeft / (diagramData?.timeLimit || 60)) * 100
  const isFrozen = frozenUntil && Date.now() < frozenUntil
  const isSpeedBlitz = selectedMode.id === 'speed_blitz'

  // Subject theme
  const subjectColor = selectedSubject.color || '#e94560'
  const subjectGlow = selectedSubject.glow || 'rgba(233,69,96,0.3)'

  if (!diagramData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h2 className="text-2xl font-bold mb-2">Coming Soon!</h2>
        <p className="text-white/50 mb-6 max-w-sm">
          <strong>{selectedMode.name}</strong> mode for <strong>{selectedSubject.name}</strong> is not yet available.
        </p>
        <button
          onClick={() => setCurrentScreen('select')}
          className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/80 transition"
        >
          ← Try Another
        </button>
      </div>
    )
  }

  const total = diagramData.labels?.length || diagramData.steps?.length || diagramData.items?.length || diagramData.leftItems?.length || diagramData.questions?.length || 1
  const accuracy = Math.round((correctCount / Math.max(total, 1)) * 100)

  return (
    <div className="min-h-screen flex flex-col bg-secondary text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-primary/50 backdrop-blur-sm sticky top-0 z-40">
        <button
          onClick={() => setCurrentScreen('select')}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition"
        >
          ← Back
        </button>
        <div className="text-center">
          <div className="text-sm font-bold" style={{ color: subjectColor }}>{selectedSubject.icon} {selectedSubject.name}</div>
          <div className="text-xs text-white/50">{selectedMode.icon} {selectedMode.name}</div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-sm font-bold text-yellow-400">⭐ {score}</div>
          {isDoubleXP && <div className="text-[10px] text-purple-300 font-semibold">✨ 2× XP!</div>}
          {combo >= 2 && (
            <div className="text-xs text-orange-400 font-semibold animate-bounce">🔥 x{combo} combo!</div>
          )}
        </div>
      </header>

      {/* Shield banner */}
      {shieldActive && (
        <div className="flex items-center justify-center gap-2 py-1.5 bg-cyan-500/20 border-b border-cyan-500/30 text-cyan-300 text-xs font-semibold">
          🛡️ Shield Active — Next wrong answer blocked!
        </div>
      )}

      {/* Timer Bar */}
      <div className="h-1.5 bg-white/10 relative">
        <div
          className={`h-full transition-all duration-1000 ${
            timeLeft <= 10 ? 'bg-red-500' : isFrozen ? 'bg-blue-400' : isSpeedBlitz ? 'bg-gradient-to-r from-yellow-400 to-red-500' : ''
          }`}
          style={
            !isFrozen && timeLeft > 10 && !isSpeedBlitz
              ? { width: `${timerPct}%`, background: `linear-gradient(90deg, ${subjectColor}, ${subjectColor}99)` }
              : { width: `${timerPct}%` }
          }
        />
      </div>

      {/* Timer + Power-ups */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary/30">
        <div className={`text-sm font-mono font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : isFrozen ? 'text-blue-300' : isSpeedBlitz && timeLeft <= 15 ? 'text-yellow-400 animate-pulse' : 'text-white/70'}`}>
          {isFrozen ? '🧊 FROZEN' : isSpeedBlitz ? `⚡ ${timeLeft}s` : `⏱ ${timeLeft}s`}
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <button
            onClick={() => usePowerUp('freeze')}
            disabled={powerUpsUsed.freeze || isSpeedBlitz}
            title="Freeze timer for 10 seconds"
            className={`px-2 py-1 rounded-lg text-xs font-medium transition ${(powerUpsUsed.freeze || isSpeedBlitz) ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/30'}`}
          >
            🧊 Freeze
          </button>
          <button
            onClick={() => usePowerUp('glow')}
            disabled={powerUpsUsed.glow || isSpeedBlitz}
            title="Highlight correct zone for 4 seconds"
            className={`px-2 py-1 rounded-lg text-xs font-medium transition ${(powerUpsUsed.glow || isSpeedBlitz) ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/40 border border-yellow-500/30'}`}
          >
            ✨ Glow
          </button>
          <button
            onClick={() => usePowerUp('fiftyFifty')}
            disabled={powerUpsUsed.fiftyFifty}
            title="50-50: Removes half wrong answers"
            className={`px-2 py-1 rounded-lg text-xs font-medium transition ${powerUpsUsed.fiftyFifty ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 border border-purple-500/30'}`}
          >
            ⚡ 50-50
          </button>
          <button
            onClick={() => usePowerUp('shield')}
            disabled={powerUpsUsed.shield}
            title="Shield: Block one wrong answer penalty"
            className={`px-2 py-1 rounded-lg text-xs font-medium transition ${powerUpsUsed.shield ? 'bg-white/5 text-white/20 cursor-not-allowed' : shieldActive ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400 animate-pulse' : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 border border-cyan-500/30'}`}
          >
            🛡️ Shield
          </button>
          <button
            onClick={() => usePowerUp('doubleXP')}
            disabled={powerUpsUsed.doubleXP}
            title="Double XP for 20 seconds"
            className={`px-2 py-1 rounded-lg text-xs font-medium transition ${powerUpsUsed.doubleXP ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/40 border border-violet-500/30'}`}
          >
            ✨ 2×XP
          </button>
        </div>
      </div>

      {/* Game Mode Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!showResult ? (
          <ModeRenderer
            key={gameKey}
            diagramData={diagramData}
            mode={selectedMode.id}
            onCorrect={onCorrect}
            onWrong={onWrong}
            endGame={endGame}
            glowZone={glowZone}
            fiftyFiftyUsed={powerUpsUsed.fiftyFifty}
            play={play}
            subjectColor={subjectColor}
          />
        ) : (
          <ResultScreen
            score={score}
            correctCount={correctCount}
            wrongCount={wrongCount}
            total={total}
            mode={selectedMode.id}
            subject={selectedSubject.id}
            onRestart={restart}
            onBack={() => setCurrentScreen('select')}
            wrongAnswers={wrongAnswers}
            shareCopied={shareCopied}
            onShare={() => {
              const ok = shareScore({ score, subject: selectedSubject.id, mode: selectedMode.id, accuracy, streak: 0 })
              if (ok) { setShareCopied(true); setTimeout(() => setShareCopied(false), 2500) }
            }}
            subjectColor={subjectColor}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE ROUTER
// ═══════════════════════════════════════════════════════════════════════════
function ModeRenderer({ diagramData, mode, onCorrect, onWrong, endGame, glowZone, fiftyFiftyUsed, play, subjectColor }) {
  switch (mode) {
    case 'label_rush':
      return <LabelRushMode data={diagramData} onCorrect={onCorrect} onWrong={onWrong} endGame={endGame} glowZone={glowZone} play={play} subjectColor={subjectColor} />
    case 'sequence_snap':
      return <SequenceSnapMode data={diagramData} onCorrect={onCorrect} onWrong={onWrong} endGame={endGame} play={play} subjectColor={subjectColor} />
    case 'spot_fault':
      return <SpotFaultMode data={diagramData} onCorrect={onCorrect} onWrong={onWrong} endGame={endGame} fiftyFiftyUsed={fiftyFiftyUsed} play={play} />
    case 'match_links':
      return <MatchLinksMode data={diagramData} onCorrect={onCorrect} onWrong={onWrong} endGame={endGame} play={play} subjectColor={subjectColor} />
    case 'interpret':
      return <InterpretMode data={diagramData} onCorrect={onCorrect} onWrong={onWrong} endGame={endGame} play={play} />
    case 'speed_blitz':
      return <SpeedBlitzMode data={diagramData} onCorrect={onCorrect} onWrong={onWrong} endGame={endGame} play={play} />
    default:
      return (
        <div className="text-center py-12 text-white/50">
          <p>Mode "{mode}" not implemented yet.</p>
        </div>
      )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE 1: LABEL RUSH
// ═══════════════════════════════════════════════════════════════════════════
function LabelRushMode({ data, onCorrect, onWrong, endGame, glowZone, play, subjectColor }) {
  const [placedLabels, setPlacedLabels] = useState({})
  const [selectedLabel, setSelectedLabel] = useState(null)
  const [feedback, setFeedback] = useState({})
  const [hintZone, setHintZone] = useState(null)

  const labels = data.labels || []
  const zones = data.zones || labels.map((l, i) => ({ id: l.correctZone, label: `Zone ${i + 1}`, x: 5 + (i % 5) * 19, y: 10 + Math.floor(i / 5) * 30, width: 17, height: 25 }))
  const uniqueZones = zones.filter((z, i, arr) => arr.findIndex(z2 => z2.id === z.id) === i)

  const placedLabelIds = Object.values(placedLabels)
  const availableLabels = labels.filter(l => !placedLabelIds.includes(l.id))

  const handleZoneClick = (zone) => {
    if (!selectedLabel) return
    const label = labels.find(l => l.id === selectedLabel)
    if (!label) return

    if (label.correctZone === zone.id) {
      setPlacedLabels(prev => ({ ...prev, [zone.id]: selectedLabel }))
      setFeedback(prev => ({ ...prev, [zone.id]: 'correct' }))
      onCorrect(100)
      setSelectedLabel(null)
      const newPlaced = { ...placedLabels, [zone.id]: selectedLabel }
      const allZones = uniqueZones.map(z => z.id)
      const allPlaced = allZones.every(zid => newPlaced[zid])
      if (allPlaced) setTimeout(() => endGame(true), 600)
    } else {
      setFeedback(prev => ({ ...prev, [zone.id]: 'wrong' }))
      setTimeout(() => setFeedback(prev => ({ ...prev, [zone.id]: null })), 800)
      onWrong()
    }
  }

  const showHint = () => {
    if (selectedLabel) {
      const label = labels.find(l => l.id === selectedLabel)
      if (label) setHintZone(label.correctZone)
      setTimeout(() => setHintZone(null), 3000)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">{data.title}</h3>
      <p className="text-sm text-white/50 mb-4">{data.description}</p>

      <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
        💡 Click a label below, then click its zone above to place it.
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {uniqueZones.map((zone) => {
          const placedId = placedLabels[zone.id]
          const placedLabel = labels.find(l => l.id === placedId)
          const fb = feedback[zone.id]
          const isGlowing = glowZone === zone.id || hintZone === zone.id

          return (
            <button
              key={zone.id}
              onClick={() => handleZoneClick(zone)}
              disabled={!!placedLabel}
              className={`relative p-4 rounded-2xl border-2 text-sm font-medium transition-all duration-300 min-h-[80px] flex flex-col items-center justify-center gap-1 ${
                placedLabel
                  ? 'bg-green-500/20 border-green-500/60 cursor-default'
                  : fb === 'wrong'
                  ? 'bg-red-500/30 border-red-500 scale-95'
                  : isGlowing
                  ? 'bg-yellow-400/20 border-yellow-400 animate-pulse'
                  : selectedLabel
                  ? 'bg-white/10 border-white/30 hover:bg-white/20 cursor-pointer hover:scale-105'
                  : 'bg-white/5 border-white/15 cursor-default'
              }`}
              style={selectedLabel && !placedLabel && fb !== 'wrong' && !isGlowing ? { borderColor: subjectColor + '60' } : {}}
            >
              <span className="text-white/40 text-xs">{zone.label}</span>
              {placedLabel && (
                <span className="text-green-300 font-bold text-center text-xs">✅ {placedLabel.text}</span>
              )}
              {fb === 'wrong' && <span className="text-red-300 text-xs animate-bounce">❌</span>}
            </button>
          )
        })}
      </div>

      <div className="mb-4">
        <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Select a Label:</div>
        <div className="flex flex-wrap gap-2">
          {availableLabels.map((label) => (
            <button
              key={label.id}
              onClick={() => setSelectedLabel(selectedLabel === label.id ? null : label.id)}
              title={label.hint}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 hover:scale-105 active:scale-95 ${
                selectedLabel === label.id
                  ? 'text-white border-transparent shadow-lg'
                  : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
              }`}
              style={selectedLabel === label.id ? { backgroundColor: subjectColor + '30', borderColor: subjectColor, boxShadow: `0 0 15px ${subjectColor}40` } : {}}
            >
              {label.text}
            </button>
          ))}
          {availableLabels.length === 0 && (
            <p className="text-green-400 text-sm font-semibold">🎉 All labels placed!</p>
          )}
        </div>
      </div>

      {selectedLabel && (
        <button onClick={showHint} className="text-xs text-yellow-400 hover:text-yellow-300 transition underline">
          💡 Show correct zone for selected label
        </button>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(placedLabelIds.length / uniqueZones.length) * 100}%`, background: `linear-gradient(90deg, ${subjectColor}, ${subjectColor}99)` }}
          />
        </div>
        <span className="text-xs text-white/50">{placedLabelIds.length}/{uniqueZones.length}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE 2: SEQUENCE SNAP
// ═══════════════════════════════════════════════════════════════════════════
function SequenceSnapMode({ data, onCorrect, onWrong, endGame, subjectColor }) {
  const steps = data.steps || []
  const [order, setOrder] = useState(() => [...steps].sort(() => Math.random() - 0.5))
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(null)

  const handleStepClick = (idx) => {
    if (submitted) return
    if (selectedIdx === null) {
      setSelectedIdx(idx)
    } else if (selectedIdx === idx) {
      setSelectedIdx(null)
    } else {
      const newOrder = [...order]
      ;[newOrder[selectedIdx], newOrder[idx]] = [newOrder[idx], newOrder[selectedIdx]]
      setOrder(newOrder)
      setSelectedIdx(null)
    }
  }

  const checkOrder = () => {
    const res = order.map((step, i) => step.order === i + 1)
    setResults(res)
    setSubmitted(true)
    const correctOnes = res.filter(Boolean).length
    if (correctOnes === steps.length) {
      onCorrect(200)
      setTimeout(() => endGame(true), 1000)
    } else {
      res.forEach((correct) => {
        if (correct) onCorrect(50)
        else onWrong()
      })
    }
  }

  const reset = () => {
    setOrder([...steps].sort(() => Math.random() - 0.5))
    setSubmitted(false)
    setResults([])
    setSelectedIdx(null)
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">{data.title}</h3>
      <p className="text-sm text-white/50 mb-4">{data.description}</p>

      <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
        💡 Click a step to select it, then click another step to swap their positions.
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {order.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => handleStepClick(idx)}
            disabled={submitted}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left text-sm transition-all duration-200 ${
              submitted
                ? results[idx]
                  ? 'bg-green-500/20 border-green-500/60 text-green-300'
                  : 'bg-red-500/20 border-red-500/60 text-red-300'
                : selectedIdx === idx
                ? 'bg-white/10 border-transparent text-white scale-[1.02] shadow-lg'
                : selectedIdx !== null
                ? 'bg-white/5 border-white/20 hover:scale-[1.01] cursor-pointer'
                : 'bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/30 cursor-pointer'
            }`}
            style={selectedIdx === idx && !submitted ? { borderColor: subjectColor, boxShadow: `0 0 15px ${subjectColor}30` } : {}}
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              submitted
                ? results[idx] ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                : selectedIdx === idx
                ? 'text-white'
                : 'bg-white/10 text-white/50'
            }`}
            style={selectedIdx === idx && !submitted ? { backgroundColor: subjectColor } : {}}
            >
              {submitted ? (results[idx] ? '✓' : '✗') : idx + 1}
            </span>
            <span className="flex-1">{step.text}</span>
            {submitted && (
              <span className="text-xs text-white/40">→ #{step.order}</span>
            )}
          </button>
        ))}
      </div>

      {!submitted ? (
        <button
          onClick={checkOrder}
          className="w-full py-3 rounded-xl text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
          style={{ background: `linear-gradient(135deg, ${subjectColor}, ${subjectColor}99)` }}
        >
          ✅ Check My Order
        </button>
      ) : (
        <div className="space-y-3">
          {results.every(Boolean) ? (
            <div className="text-center py-4 text-green-400 font-bold text-lg">🎉 Perfect Order!</div>
          ) : (
            <div className="text-center py-2 text-red-400 text-sm">
              {results.filter(Boolean).length}/{steps.length} correct positions
            </div>
          )}
          <button onClick={reset} className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition font-medium">
            🔄 Try Again
          </button>
          <button onClick={() => endGame(results.filter(Boolean).length > steps.length / 2)} className="w-full py-3 rounded-xl bg-accent/50 hover:bg-accent/70 text-white transition font-medium">
            Continue →
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE 3: SPOT THE FAULT
// ═══════════════════════════════════════════════════════════════════════════
function SpotFaultMode({ data, onCorrect, onWrong, endGame, fiftyFiftyUsed }) {
  const allItems = data.items || []
  const [visibleItems, setVisibleItems] = useState(() => allItems)
  const [selected, setSelected] = useState({})
  const [showFault, setShowFault] = useState(null)
  const done = Object.keys(selected).length === visibleItems.length

  useEffect(() => {
    if (fiftyFiftyUsed) {
      const faults = allItems.filter(i => !i.isCorrect)
      const corrects = allItems.filter(i => i.isCorrect)
      const halfCorrects = corrects.slice(0, Math.ceil(corrects.length / 2))
      setVisibleItems([...faults, ...halfCorrects].sort(() => Math.random() - 0.5))
    }
  }, [fiftyFiftyUsed])

  const handleClick = (item) => {
    if (selected[item.id]) return
    if (!item.isCorrect) {
      setSelected(prev => ({ ...prev, [item.id]: 'found' }))
      setShowFault(item)
      onCorrect(150)
    } else {
      setSelected(prev => ({ ...prev, [item.id]: 'wrongClick' }))
      onWrong({ text: item.text, fault: 'This was a correct statement — you clicked it incorrectly.' })
    }
    if (Object.keys(selected).length + 1 === visibleItems.length) {
      setTimeout(() => endGame(true), 1000)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">{data.title}</h3>
      <p className="text-sm text-white/50 mb-4">{data.description}</p>

      <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
        🔍 Click on any INCORRECT statement to expose the fault. Avoid clicking correct ones!
      </div>

      {showFault && (
        <div className="mb-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 animate-slide-up">
          <div className="text-orange-300 font-semibold text-sm mb-1">💡 Why it's wrong:</div>
          <div className="text-white/80 text-sm">{showFault.fault}</div>
          <button onClick={() => setShowFault(null)} className="mt-2 text-xs text-orange-400 hover:text-orange-300 underline transition">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {visibleItems.map((item) => {
          const status = selected[item.id]
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              disabled={!!status}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left text-sm transition-all duration-200 ${
                status === 'found'
                  ? 'bg-orange-500/20 border-orange-500/60 text-orange-200'
                  : status === 'wrongClick'
                  ? 'bg-red-500/10 border-red-500/30 text-white/40'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 cursor-pointer active:scale-[0.98]'
              }`}
            >
              <span className="flex-shrink-0 mt-0.5">
                {status === 'found' ? '🐛' : status === 'wrongClick' ? '✓' : '❓'}
              </span>
              <span>{item.text}</span>
            </button>
          )
        })}
      </div>

      {done && (
        <div className="mt-6 text-center">
          <p className="text-green-400 font-bold mb-3">🎉 All faults found!</p>
          <button onClick={() => endGame(true)} className="px-8 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition">
            View Results
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE 4: MATCH LINKS
// ═══════════════════════════════════════════════════════════════════════════
function MatchLinksMode({ data, onCorrect, onWrong, endGame, subjectColor }) {
  const leftItems = data.leftItems || []
  const rightItems = data.rightItems || []
  const correctMatches = data.correctMatches || []

  const [selectedLeft, setSelectedLeft] = useState(null)
  const [matches, setMatches] = useState({})
  const [feedback, setFeedback] = useState({})

  const matchedLeftIds = Object.keys(matches)
  const matchedRightIds = Object.values(matches)

  const handleLeftClick = (item) => {
    if (matchedLeftIds.includes(item.id)) return
    setSelectedLeft(selectedLeft?.id === item.id ? null : item)
  }

  const handleRightClick = (item) => {
    if (!selectedLeft || matchedRightIds.includes(item.id)) return
    const correct = correctMatches.find(m => m.leftId === selectedLeft.id && m.rightId === item.id)
    if (correct) {
      setMatches(prev => ({ ...prev, [selectedLeft.id]: item.id }))
      setFeedback(prev => ({ ...prev, [selectedLeft.id]: 'correct', [item.id]: 'correct' }))
      onCorrect(120)
      setSelectedLeft(null)
      const newCount = Object.keys(matches).length + 1
      if (newCount === leftItems.length) setTimeout(() => endGame(true), 600)
    } else {
      setFeedback(prev => ({ ...prev, [selectedLeft.id]: 'wrong', [item.id]: 'wrong' }))
      setTimeout(() => setFeedback(prev => {
        const n = { ...prev }
        delete n[selectedLeft.id]; delete n[item.id]
        return n
      }), 700)
      onWrong()
      setSelectedLeft(null)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">{data.title}</h3>
      <p className="text-sm text-white/50 mb-4">{data.description}</p>

      <div className="mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
        🔗 Click an item on the left, then click its match on the right.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/30 uppercase tracking-wider mb-1 text-center">Items</div>
          {leftItems.map((item) => {
            const isMatched = matchedLeftIds.includes(item.id)
            const fb = feedback[item.id]
            return (
              <button
                key={item.id}
                onClick={() => handleLeftClick(item)}
                disabled={isMatched}
                className={`p-3 rounded-xl border-2 text-sm text-center transition-all duration-200 ${
                  isMatched
                    ? 'bg-green-500/20 border-green-500/50 text-green-300 cursor-default'
                    : fb === 'wrong'
                    ? 'bg-red-500/20 border-red-500 text-red-300'
                    : selectedLeft?.id === item.id
                    ? 'text-white scale-105 shadow-lg'
                    : 'bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/30 cursor-pointer'
                }`}
                style={selectedLeft?.id === item.id ? { borderColor: subjectColor, backgroundColor: subjectColor + '25', boxShadow: `0 0 15px ${subjectColor}30` } : {}}
              >
                {isMatched && '✅ '}{item.text}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/30 uppercase tracking-wider mb-1 text-center">Matches</div>
          {rightItems.map((item) => {
            const isMatched = matchedRightIds.includes(item.id)
            const fb = feedback[item.id]
            return (
              <button
                key={item.id}
                onClick={() => handleRightClick(item)}
                disabled={isMatched || !selectedLeft}
                className={`p-3 rounded-xl border-2 text-sm text-center transition-all duration-200 ${
                  isMatched
                    ? 'bg-green-500/20 border-green-500/50 text-green-300 cursor-default'
                    : fb === 'wrong'
                    ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse'
                    : selectedLeft
                    ? 'bg-white/10 border-white/30 hover:border-accent hover:bg-accent/10 cursor-pointer hover:scale-105'
                    : 'bg-white/5 border-white/10 text-white/30'
                }`}
              >
                {isMatched && '✅ '}{item.text}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(matchedLeftIds.length / leftItems.length) * 100}%`, background: `linear-gradient(90deg, ${subjectColor}, ${subjectColor}99)` }}
          />
        </div>
        <span className="text-xs text-white/50">{matchedLeftIds.length}/{leftItems.length}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE 5: INTERPRET (MCQ)
// ═══════════════════════════════════════════════════════════════════════════
function InterpretMode({ data, onCorrect, onWrong, endGame }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const options = data.options || []

  const handleSelect = (option) => {
    if (revealed) return
    setSelected(option.id)
    setRevealed(true)
    if (option.isCorrect) {
      onCorrect(200)
      setTimeout(() => endGame(true), 1500)
    } else {
      onWrong({ text: option.text, fault: data.explanation || 'Incorrect option selected.' })
      setTimeout(() => endGame(false), 2500)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">{data.title}</h3>
      <p className="text-sm text-white/50 mb-4">{data.description}</p>

      <div className="p-5 rounded-2xl bg-white/5 border border-white/15 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-accent to-purple-400" />
        <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed pl-3">{data.question}</p>
      </div>

      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = selected === option.id
          const showCorrect = revealed && option.isCorrect
          const showWrong = revealed && isSelected && !option.isCorrect

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              disabled={revealed}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left text-sm transition-all duration-300 ${
                showCorrect
                  ? 'bg-green-500/25 border-green-500 text-green-200'
                  : showWrong
                  ? 'bg-red-500/25 border-red-500 text-red-200'
                  : revealed
                  ? 'bg-white/5 border-white/10 text-white/30 cursor-default'
                  : 'bg-white/5 border-white/15 hover:bg-white/10 hover:border-accent/50 cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                showCorrect ? 'bg-green-500 text-white'
                : showWrong ? 'bg-red-500 text-white'
                : 'bg-white/10 text-white/50'
              }`}>
                {showCorrect ? '✓' : showWrong ? '✗' : option.id.toUpperCase()}
              </span>
              <span>{option.text}</span>
            </button>
          )
        })}
      </div>

      {revealed && data.explanation && (
        <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 animate-slide-up">
          <div className="text-blue-300 font-semibold text-sm mb-1">📖 Explanation:</div>
          <div className="text-white/80 text-sm">{data.explanation}</div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE 6: SPEED BLITZ — Rapid-fire MCQ
// ═══════════════════════════════════════════════════════════════════════════
function SpeedBlitzMode({ data, onCorrect, onWrong, endGame, play }) {
  const questions = data.questions || []
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flash, setFlash] = useState(null) // 'correct' | 'wrong'
  const [answered, setAnswered] = useState(0)
  const [done, setDone] = useState(false)
  const [shownQuestions] = useState(() => [...questions].sort(() => Math.random() - 0.5))

  const currentQ = shownQuestions[currentIdx]

  const handleAnswer = (optionIdx) => {
    if (done || flash) return
    const isCorrect = optionIdx === currentQ.correct
    setFlash(isCorrect ? 'correct' : 'wrong')

    if (isCorrect) {
      onCorrect(50)
      play('blitz')
    } else {
      onWrong({ text: currentQ.options[optionIdx], fault: `Correct answer: ${currentQ.options[currentQ.correct]}` })
    }

    setTimeout(() => {
      setFlash(null)
      setAnswered(a => a + 1)
      if (currentIdx + 1 >= shownQuestions.length) {
        setDone(true)
        setTimeout(() => endGame(true), 500)
      } else {
        setCurrentIdx(i => i + 1)
      }
    }, 350)
  }

  const progress = Math.round((currentIdx / shownQuestions.length) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-black text-yellow-400">⚡ Speed Blitz</div>
        <div className="text-sm text-white/50">{currentIdx + 1} / {shownQuestions.length}</div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-yellow-400 to-red-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flash overlay */}
      <div className={`relative rounded-2xl overflow-hidden transition-all duration-200 mb-4 ${flash === 'correct' ? 'ring-2 ring-green-400' : flash === 'wrong' ? 'ring-2 ring-red-400' : ''}`}>
        <div className={`absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-200 ${flash === 'correct' ? 'bg-green-500/20 opacity-100' : flash === 'wrong' ? 'bg-red-500/20 opacity-100' : 'opacity-0'}`} />

        <div className="p-5 rounded-2xl bg-white/5 border border-white/15">
          <div className="text-sm text-white/40 uppercase tracking-wider mb-2 text-center">Question {currentIdx + 1}</div>
          <p className="text-base font-semibold text-center text-white leading-snug">{currentQ?.text}</p>
        </div>
      </div>

      {/* Options — 2×2 grid for speed */}
      <div className="grid grid-cols-2 gap-2">
        {currentQ?.options.map((opt, i) => {
          const letters = ['A', 'B', 'C', 'D']
          const bgColors = ['bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/40', 'bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/40', 'bg-green-500/20 border-green-500/30 hover:bg-green-500/40', 'bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/40']
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={!!flash || done}
              className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${bgColors[i]} ${flash ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {letters[i]}
              </span>
              <span className="leading-tight">{opt}</span>
            </button>
          )
        })}
      </div>

      {/* Score so far */}
      <div className="mt-4 text-center text-xs text-white/30">
        Tap fast! Each correct answer = +50 pts
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULT SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function ResultScreen({ score, correctCount, wrongCount, total, mode, subject, onRestart, onBack, wrongAnswers, onShare, shareCopied, subjectColor }) {
  const pct = Math.round((correctCount / Math.max(total, 1)) * 100)
  const grade = pct >= 90 ? { label: 'S', color: 'text-yellow-400', bg: 'bg-yellow-400/20', border: 'border-yellow-400/50', emoji: '🏆' }
    : pct >= 70 ? { label: 'A', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/50', emoji: '🎉' }
    : pct >= 50 ? { label: 'B', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50', emoji: '👍' }
    : { label: 'C', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50', emoji: '💪' }

  const xpEarned = Math.max(Math.floor(score / 10) + (pct >= 90 ? 50 : pct >= 70 ? 30 : 15), 5)

  const [showFlashcards, setShowFlashcards] = useState(false)
  const [flashIdx, setFlashIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)

  if (showFlashcards && wrongAnswers.length > 0) {
    const card = wrongAnswers[flashIdx]
    return (
      <div className="text-center py-6 animate-slide-up">
        <div className="text-sm text-white/40 mb-2 uppercase tracking-widest">Review Wrong Answers</div>
        <div className="text-sm text-white/30 mb-6">{flashIdx + 1} / {wrongAnswers.length}</div>

        <div className="p-6 rounded-2xl bg-white/5 border border-white/15 mb-4 text-left relative overflow-hidden min-h-[120px] flex flex-col justify-center">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-400 to-orange-400" />
          <p className="text-white/80 pl-3 leading-relaxed">{card.text}</p>
        </div>

        {!revealed ? (
          <button onClick={() => setRevealed(true)} className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition mb-3">
            💡 Show Correct Answer
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 mb-3 text-left animate-slide-up">
            <div className="text-green-300 font-semibold text-sm mb-1">✅ Explanation:</div>
            <div className="text-white/80 text-sm">{card.fault}</div>
          </div>
        )}

        <div className="flex gap-2">
          {flashIdx > 0 && <button onClick={() => { setFlashIdx(i => i - 1); setRevealed(false) }} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition text-sm">← Prev</button>}
          {flashIdx < wrongAnswers.length - 1
            ? <button onClick={() => { setFlashIdx(i => i + 1); setRevealed(false) }} className="flex-1 py-2.5 rounded-xl bg-accent/50 hover:bg-accent/70 transition text-sm font-medium">Next →</button>
            : <button onClick={() => setShowFlashcards(false)} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 transition text-sm font-medium">Done ✅</button>
          }
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-8 animate-bounce-in">
      <div className="text-5xl mb-4">{grade.emoji}</div>
      <h2 className="text-3xl font-black mb-1">Game Over!</h2>
      <p className="text-white/50 text-sm mb-6">Here's how you did</p>

      {/* Grade Badge */}
      <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 mb-4 ${grade.bg} ${grade.border}`}>
        <span className={`text-4xl font-black ${grade.color}`}>{grade.label}</span>
      </div>

      {/* XP Earned */}
      <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/15 border border-yellow-500/30">
        <span className="text-yellow-300 font-bold text-sm">+{xpEarned} XP earned!</span>
        <span className="text-yellow-400 text-sm">⭐</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-2xl font-black text-yellow-400">⭐ {score}</div>
          <div className="text-xs text-white/40 mt-1">Final Score</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-2xl font-black text-green-400">{correctCount}</div>
          <div className="text-xs text-white/40 mt-1">Correct</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-2xl font-black text-red-400">{wrongCount}</div>
          <div className="text-xs text-white/40 mt-1">Wrong</div>
        </div>
      </div>

      {/* Accuracy Bar */}
      <div className="mb-6 text-left px-2">
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Accuracy</span><span>{pct}%</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${pct}%`,
              backgroundColor: pct >= 70 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#ef4444'
            }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onRestart}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
          style={{ background: `linear-gradient(135deg, ${subjectColor}, ${subjectColor}99)` }}
        >
          🔄 Play Again
        </button>

        {/* Share */}
        <button
          onClick={onShare}
          className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium transition flex items-center justify-center gap-2"
        >
          {shareCopied ? '✅ Copied to Clipboard!' : '📤 Share Score'}
        </button>

        {/* Flashcard review */}
        {wrongAnswers.length > 0 && (
          <button
            onClick={() => setShowFlashcards(true)}
            className="w-full py-3 rounded-2xl bg-orange-500/15 border border-orange-500/30 hover:bg-orange-500/25 text-orange-300 font-medium transition"
          >
            📖 Review {wrongAnswers.length} Wrong Answer{wrongAnswers.length !== 1 ? 's' : ''}
          </button>
        )}

        <button
          onClick={onBack}
          className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-medium transition"
        >
          ← Select Another Mode
        </button>
      </div>
    </div>
  )
}

export default GameScreen