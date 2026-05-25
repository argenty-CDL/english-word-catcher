import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Heart, Play, RotateCcw, Info, CheckCircle2, XCircle } from 'lucide-react';

// Push an analytics event to the GTM dataLayer. GTM then routes it to GA4,
// HubSpot, etc. No-op safe if GTM isn't present on the host page.
const track = (event: string, params: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
};

// Word list with correct and incorrect spellings
const WORD_PAIRS = [
  { correct: 'Believe', incorrect: 'Belive' },
  { correct: 'Receive', incorrect: 'Recieve' },
  { correct: 'Friend', incorrect: 'Freind' },
  { correct: 'Tomorrow', incorrect: 'Tommorow' },
  { correct: 'Separate', incorrect: 'Seperate' },
  { correct: 'Definitely', incorrect: 'Definitly' },
  { correct: 'Accommodate', incorrect: 'Accomodate' },
  { correct: 'Necessary', incorrect: 'Neccessary' },
  { correct: 'Calendar', incorrect: 'Calender' },
  { correct: 'Business', incorrect: 'Bussiness' },
  { correct: 'Across', incorrect: 'Accross' },
  { correct: 'Address', incorrect: 'Adress' },
  { correct: 'Argument', incorrect: 'Arguement' },
  { correct: 'Beginning', incorrect: 'Begining' },
  { correct: 'Committee', incorrect: 'Comitee' },
  { correct: 'Experience', incorrect: 'Experiance' },
  { correct: 'Government', incorrect: 'Goverment' },
  { correct: 'Independent', incorrect: 'Independant' },
  { correct: 'Knowledge', incorrect: 'Knowlege' },
  { correct: 'Maintenance', incorrect: 'Maintainance' },
  { correct: 'Occurred', incorrect: 'Ocured' },
  { correct: 'Possession', incorrect: 'Posession' },
  { correct: 'Publicly', incorrect: 'Publically' },
  { correct: 'Questionnaire', incorrect: 'Questionaire' },
  { correct: 'Rhythm', incorrect: 'Rythm' },
  { correct: 'Schedule', incorrect: 'Scedule' },
  { correct: 'Success', incorrect: 'Sucess' },
  { correct: 'Truly', incorrect: 'Truely' },
  { correct: 'Until', incorrect: 'Untill' },
  { correct: 'Vacuum', incorrect: 'Vaccum' },
];

// Height of a falling word's box, in logical (CSS) pixels.
const WORD_BOX_HEIGHT = 36;

// Sound Design Utility
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

const playSound = (type: 'ding' | 'buzz') => {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'ding') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else {
    osc.type = 'square';
    osc.frequency.setValueAtTime(110, now); // A2
    osc.frequency.linearRampToValueAtTime(55, now + 0.2); // A1
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }
};

type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

interface Feedback {
  id: number;
  x: number;
  y: number;
  isCorrect: boolean;
  life: number; // 0 to 1
}

interface FallingWord {
  id: number;
  text: string;
  x: number;
  y: number;
  isCorrect: boolean;
  speed: number;
  width: number;
}

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
}

const HeartLife = ({ active, isLosing }: { active: boolean; isLosing: boolean; key?: React.Key }) => {
  return (
    <div className="relative w-6 h-6 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {active ? (
          <motion.div
            key="active"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ 
              scale: [1, 1.5, 0.5], 
              rotate: [0, 15, -15, 0],
              opacity: 0,
              transition: { duration: 0.4 }
            }}
          >
            <Heart className="w-5 h-5 text-red-400 fill-red-400" />
          </motion.div>
        ) : (
          <motion.div
            key="inactive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
          >
            <Heart className="w-5 h-5 text-gray-300" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {isLosing && (
        <motion.div
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 2, opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="absolute text-red-500 font-bold pointer-events-none"
        >
          💔
        </motion.div>
      )}
    </div>
  );
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [prevLives, setPrevLives] = useState(3);
  const [errors, setErrors] = useState<{ correct: string; incorrect: string }[]>([]);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('wordCatcherHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const playerRef = useRef<Player>({
    x: 0,
    y: 0,
    width: 80,
    height: 20,
  });

  const wordsRef = useRef<FallingWord[]>([]);
  const feedbacksRef = useRef<Feedback[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const requestRef = useRef<number>(0);
  const lastSpawnTime = useRef<number>(0);
  const spawnInterval = useRef<number>(2000); // ms
  const baseSpeed = useRef<number>(2);
  // Logical drawing size in CSS pixels (the canvas buffer may be larger on
  // high-DPI screens). All game logic works in this coordinate space.
  const dimsRef = useRef({ w: 800, h: 600 });

  const initGame = useCallback(() => {
    setScore(0);
    setLives(3);
    setPrevLives(3);
    setErrors([]);
    wordsRef.current = [];
    feedbacksRef.current = [];
    lastSpawnTime.current = performance.now();
    spawnInterval.current = 2000;
    baseSpeed.current = 2;

    const { w, h } = dimsRef.current;
    playerRef.current = {
      x: w / 2 - 40,
      y: h - 40,
      width: 80,
      height: 20,
    };
  }, []);

  const spawnWord = useCallback((canvasWidth: number) => {
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    const isCorrect = Math.random() > 0.4; // 60% chance for correct word
    const text = isCorrect ? pair.correct : pair.incorrect;
    
    // Estimate width based on text length (matches the 18px font above).
    const width = text.length * 13 + 24;
    const x = Math.random() * (canvasWidth - width);
    
    const newWord: FallingWord = {
      id: Date.now(),
      text,
      x,
      y: -30,
      isCorrect,
      speed: baseSpeed.current + Math.random() * 1.5,
      width,
    };
    
    wordsRef.current.push(newWord);
  }, []);

  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w: W, h: H } = dimsRef.current;
    // Draw in CSS-pixel coordinates; the buffer is scaled by the device pixel
    // ratio so text stays crisp on high-DPI (Retina) screens.
    const dpr = canvas.width / W || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear canvas
    ctx.clearRect(0, 0, W, H);

    // Keep the paddle resting on the floor (handles container resizes).
    const player = playerRef.current;
    player.y = H - 40;
    const moveSpeed = 10;
    if (keysRef.current['ArrowLeft']) {
      player.x = Math.max(0, player.x - moveSpeed);
    }
    if (keysRef.current['ArrowRight']) {
      player.x = Math.min(W - player.width, player.x + moveSpeed);
    }

    // Draw player (a nice rounded paddle/basket)
    ctx.fillStyle = '#1ABC9C'; // Requested Green Color
    ctx.beginPath();
    ctx.roundRect(player.x, player.y, player.width, player.height, 10);
    ctx.fill();
    
    // Draw player accent
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(player.x + 10, player.y + 5, player.width - 20, 4, 2);
    ctx.fill();

    // Spawn words
    if (time - lastSpawnTime.current > spawnInterval.current) {
      spawnWord(W);
      lastSpawnTime.current = time;
      // Gradually increase difficulty
      spawnInterval.current = Math.max(800, spawnInterval.current * 0.99);
      baseSpeed.current += 0.02;
    }

    // Update and draw words
    for (let i = wordsRef.current.length - 1; i >= 0; i--) {
      const word = wordsRef.current[i];
      word.y += word.speed;

      // Draw word box
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.fillStyle = '#FEF0C8'; // Requested Word Box Color
      ctx.beginPath();
      ctx.roundRect(word.x, word.y, word.width, WORD_BOX_HEIGHT, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw word text
      ctx.fillStyle = '#1A1A1A';
      ctx.font = '600 18px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(word.text, word.x + word.width / 2, word.y + 24);

      // Collision detection
      if (
        word.y + WORD_BOX_HEIGHT > player.y &&
        word.y < player.y + player.height &&
        word.x + word.width > player.x &&
        word.x < player.x + player.width
      ) {
        // Add feedback
        feedbacksRef.current.push({
          id: Date.now(),
          x: word.x + word.width / 2,
          y: player.y - 20,
          isCorrect: word.isCorrect,
          life: 1.0
        });

        if (word.isCorrect) {
          setScore(s => s + 10);
          playSound('ding');
        } else {
          playSound('buzz');
          // Add to errors recap
          const pair = WORD_PAIRS.find(p => p.incorrect === word.text);
          if (pair) {
            setErrors(prev => {
              if (prev.some(e => e.correct === pair.correct)) return prev;
              return [...prev, pair];
            });
          }
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) setGameState('GAMEOVER');
            return newLives;
          });
        }
        wordsRef.current.splice(i, 1);
        continue;
      }

      // Remove words that fall off screen
      if (word.y > H) {
        if (word.isCorrect) {
          // Missed a correct word! Penalty.
          playSound('buzz');
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) setGameState('GAMEOVER');
            return newLives;
          });
          feedbacksRef.current.push({
            id: Date.now(),
            x: word.x + word.width / 2,
            y: H - 40,
            isCorrect: false,
            life: 1.0
          });
          // Add to errors recap
          const pair = WORD_PAIRS.find(p => p.correct === word.text);
          if (pair) {
            setErrors(prev => {
              if (prev.some(e => e.correct === pair.correct)) return prev;
              return [...prev, pair];
            });
          }
        } else {
          // Successfully avoided a bad word!
          setScore(s => s + 10);
          playSound('ding');
          feedbacksRef.current.push({
            id: Date.now(),
            x: word.x + word.width / 2,
            y: H - 40,
            isCorrect: true,
            life: 1.0
          });
        }
        wordsRef.current.splice(i, 1);
      }
    }

    // Update and draw feedbacks
    for (let i = feedbacksRef.current.length - 1; i >= 0; i--) {
      const fb = feedbacksRef.current[i];
      fb.life -= 0.02;
      fb.y -= 1; // Float up

      if (fb.life <= 0) {
        feedbacksRef.current.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = fb.life;
      ctx.font = 'bold 32px Inter';
      ctx.textAlign = 'center';
      if (fb.isCorrect) {
        ctx.fillStyle = '#22C55E'; // Green-500
        ctx.fillText('✓', fb.x, fb.y);
      } else {
        ctx.fillStyle = '#EF4444'; // Red-500
        ctx.fillText('✕', fb.x, fb.y);
      }
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(update);
  }, [gameState, spawnWord]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Keys we own while focused; preventDefault stops the host page from
    // scrolling when the player uses arrows/space inside the embedded game.
    const OWNED_KEYS = ['ArrowLeft', 'ArrowRight', 'Space'];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (OWNED_KEYS.includes(e.code)) e.preventDefault();
      if (e.code === 'Space') {
        setGameState(prev => {
          if (prev === 'PLAYING') return 'PAUSED';
          if (prev === 'PAUSED') return 'PLAYING';
          return prev;
        });
      }
      keysRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    // Listeners live on the game element, not window: arrows/space only act
    // when the visitor has clicked into the game, never on the article itself.
    el.addEventListener('keydown', handleKeyDown);
    el.addEventListener('keyup', handleKeyUp);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      el.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Responsive canvas: the drawing buffer tracks the element's displayed size
  // (× devicePixelRatio for sharpness). Without this the canvas renders at a
  // fixed 800×600 and gets scaled down on mobile, shrinking the text. Display
  // size is driven by CSS, so resizing the buffer never feeds back into layout.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const applySize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      dimsRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      // Re-seat the paddle on the new floor and within the new width.
      const player = playerRef.current;
      player.y = rect.height - player.height - 20;
      player.x = Math.max(0, Math.min(rect.width - player.width, player.x));
    };

    applySize();
    const ro = new ResizeObserver(applySize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Pointer control (mouse + touch + pen): the paddle follows the pointer.
  // This is what makes the game playable on mobile. The canvas has
  // `touch-action: none`, so dragging on it never scrolls the article.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const movePaddleTo = (clientX: number) => {
      const player = playerRef.current;
      const rect = canvas.getBoundingClientRect();
      // Logical space equals CSS pixels, so map the pointer directly.
      const x = clientX - rect.left - player.width / 2;
      player.x = Math.max(0, Math.min(dimsRef.current.w - player.width, x));
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (gameState !== 'PLAYING') return;
      movePaddleTo(e.clientX);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (gameState !== 'PLAYING') return;
      e.preventDefault();
      movePaddleTo(e.clientX);
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, update]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('wordCatcherHighScore', score.toString());
    }
  }, [score, highScore]);

  // Track lives for animation
  useEffect(() => {
    if (lives < prevLives) {
      const timer = setTimeout(() => setPrevLives(lives), 500);
      return () => clearTimeout(timer);
    }
  }, [lives, prevLives]);

  const startGame = () => {
    initGame();
    setGameState('PLAYING');
    // Give the game keyboard focus so arrows/space work immediately.
    containerRef.current?.focus();
    track('word_catcher_game_start');
  };

  // Report the finished game (score, mistakes made) once per game over.
  useEffect(() => {
    if (gameState === 'GAMEOVER') {
      track('word_catcher_game_over', { score, errors: errors.length });
    }
  }, [gameState, score, errors.length]);

  return (
    <div ref={containerRef} tabIndex={0} className="game-container bg-[#FDFCFB] outline-none overflow-hidden">
      {/* Header Stats */}
      <div className="absolute top-8 left-0 right-0 flex justify-between px-8 max-w-4xl mx-auto w-full z-10">
        <div className="flex items-center gap-6">
          <div className="bg-white shadow-sm border border-gray-100 px-4 py-2 rounded-2xl flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="font-display font-bold text-xl">{score}</span>
          </div>
          <div className="bg-white shadow-sm border border-gray-100 px-4 py-2 rounded-2xl flex items-center gap-2">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <HeartLife 
                  key={i} 
                  active={i < lives} 
                  isLosing={i === lives && lives < prevLives}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-gray-400 text-sm font-medium">
          <span className="uppercase tracking-wider">High Score:</span>
          <span className="text-gray-600">{highScore}</span>
        </div>
      </div>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="touch-none"
      />

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-20 overflow-y-auto"
          >
            <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-md p-10 rounded-[32px] shadow-2xl border border-gray-100 max-w-md w-full text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Play className="w-10 h-10 text-[#1ABC9C] fill-[#1ABC9C]" />
              </div>
              <h1 className="text-4xl font-display font-bold mb-4 tracking-tight">Word Catcher</h1>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Attrape les mots anglais <span className="text-emerald-600 font-semibold">correctement orthographiés</span> et évite les erreurs !
              </p>
              
              <div className="space-y-3 mb-8 text-left bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Mot correct : +10 points</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>Erreur : -1 vie</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Info className="w-4 h-4 text-emerald-500" />
                  <span>Utilise ta souris ou ton doigt pour bouger</span>
                </div>
              </div>

              <button 
                onClick={startGame}
                className="w-full bg-[#1ABC9C] hover:bg-[#16A085] text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-100 active:scale-95"
              >
                Commencer à jouer
              </button>
            </div>
            </div>
          </motion.div>
        )}

        {gameState === 'PAUSED' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-20 bg-black/20 backdrop-blur-[2px]"
          >
            <div className="bg-white p-8 rounded-[32px] shadow-xl text-center">
              <h2 className="text-3xl font-display font-bold mb-4">Pause</h2>
              <p className="text-gray-500 mb-6">Appuie sur <span className="font-bold text-[#1ABC9C]">Espace</span> pour reprendre</p>
              <button 
                onClick={() => setGameState('PLAYING')}
                className="bg-[#1ABC9C] text-white px-8 py-3 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                Reprendre
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-20 overflow-y-auto"
          >
            <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-md p-10 rounded-[32px] shadow-2xl border border-gray-100 max-w-md w-full text-center">
              <div className="text-6xl mb-6">🏁</div>
              <h2 className="text-4xl font-display font-bold mb-2 tracking-tight">Partie terminée</h2>
              <p className="text-gray-500 mb-4">Ton score final est de</p>
              
              <div className="text-6xl font-display font-black text-[#1ABC9C] mb-6">
                {score}
              </div>

              {errors.length > 0 && (
                <div className="mb-8 text-left">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Récapitulatif des erreurs :</h3>
                  <div className="bg-red-50 rounded-2xl p-4 border border-red-100 max-h-40 overflow-y-auto custom-scrollbar">
                    <ul className="space-y-2">
                      {errors.map((err, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <span className="text-red-500 line-through opacity-50">{err.incorrect}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-emerald-600 font-bold">{err.correct}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {score >= highScore && score > 0 && (
                <div className="bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full text-sm font-bold mb-8 inline-block">
                  ✨ NOUVEAU RECORD ! ✨
                </div>
              )}

              <button 
                onClick={startGame}
                className="w-full bg-[#1ABC9C] hover:bg-[#16A085] text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
                Rejouer
              </button>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
