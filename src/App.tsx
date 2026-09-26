// アプリ本体。タイトル → テスト → 結果 →（100点なら）フィーバー → フィーバー結果 の流れを管理します。
import { useEffect, useState } from 'react';
import { EffectsLayer } from './components/EffectsLayer';
import { GameScreen } from './components/GameScreen';
import { ResultScreen } from './components/ResultScreen';
import { TitleScreen } from './components/TitleScreen';
import { startDemoBot } from './lib/demoBot';
import { play, setBgm, setMuted, unlockAudio } from './lib/sound';
import { loadPrefs, loadRecords, savePrefs, saveRecords, type Preferences, type Records } from './lib/storage';
import type { FeverResult, GameConfig, GameResult, Screen } from './types';

/** URL に ?demo を付けると自動でプレイする（プレイ動画の撮影用） */
const DEMO = new URLSearchParams(window.location.search).has('demo');

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' });
  const [prefs, setPrefs] = useState<Preferences>(() => loadPrefs());
  const [records, setRecords] = useState<Records>(() => loadRecords());
  const [best, setBest] = useState({ dopa: false, time: false, fever: false });

  // 音は最初のタップで使えるようにする（ブラウザの決まり）
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => setMuted(!prefs.sound), [prefs.sound]);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', prefs.reduceMotion);
  }, [prefs.reduceMotion]);

  useEffect(() => {
    if (DEMO) return startDemoBot();
  }, []);

  const updatePrefs = (patch: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  };

  const config: GameConfig = { count: prefs.count, operation: prefs.operation };

  const start = () => {
    unlockAudio();
    play('start');
    setScreen({ name: 'game', config });
  };

  const finishGame = (result: GameResult) => {
    const key = String(result.config.count);
    const perfect = result.perfectCount === result.config.count;
    const isBestDopa = result.dopa > records.bestDopa;
    const isBestTime = perfect && (!records.bestTime[key] || result.timeMs < records.bestTime[key]);
    const next: Records = {
      ...records,
      plays: records.plays + 1,
      totalDopa: records.totalDopa + result.dopa,
      bestDopa: Math.max(records.bestDopa, result.dopa),
      bestTime: isBestTime ? { ...records.bestTime, [key]: result.timeMs } : records.bestTime,
    };
    setRecords(next);
    saveRecords(next);
    setBest({ dopa: isBestDopa, time: isBestTime, fever: false });
    setScreen({ name: 'result', result });
  };

  const finishFever = (result: FeverResult, gameConfig: GameConfig) => {
    const isBest = result.solved > records.bestFeverSolved;
    const next: Records = {
      ...records,
      totalDopa: records.totalDopa + result.dopa,
      bestDopa: Math.max(records.bestDopa, result.dopa),
      bestFeverSolved: Math.max(records.bestFeverSolved, result.solved),
    };
    setRecords(next);
    saveRecords(next);
    setBest({ dopa: false, time: false, fever: isBest });
    setScreen({ name: 'feverResult', result, config: gameConfig });
  };

  const toTitle = () => {
    setBgm(null);
    setScreen({ name: 'title' });
  };

  return (
    <>
      <EffectsLayer reduceMotion={prefs.reduceMotion} shakeTargetId="app-root" />
      <div id="app-root" style={{ height: '100%' }}>
        {screen.name === 'title' && <TitleScreen prefs={prefs} records={records} onChangePrefs={updatePrefs} onStart={start} />}
        {screen.name === 'game' && <GameScreen key="game" mode="normal" config={screen.config} onFinish={finishGame} onQuit={toTitle} />}
        {screen.name === 'result' && (
          <ResultScreen
            kind="normal"
            result={screen.result}
            isBestDopa={best.dopa}
            isBestTime={best.time}
            onExtra={() => setScreen({ name: 'fever', config: screen.result.config, startDopa: screen.result.dopa })}
            onRetry={() => setScreen({ name: 'game', config: screen.result.config })}
            onTitle={toTitle}
          />
        )}
        {screen.name === 'fever' && (
          <GameScreen
            key="fever"
            mode="fever"
            config={screen.config}
            startDopa={screen.startDopa}
            onFinish={(result) => finishFever(result, screen.config)}
            onQuit={toTitle}
          />
        )}
        {screen.name === 'feverResult' && (
          <ResultScreen
            kind="fever"
            result={screen.result}
            isBest={best.fever}
            onRetry={() => setScreen({ name: 'game', config: screen.config })}
            onTitle={toTitle}
          />
        )}
      </div>
    </>
  );
}
