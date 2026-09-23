import React from 'react';
import { WaveformChart } from './components/WaveformChart';
import { BandPowerChart } from './components/BandPowerChart';
import { ChannelSelector } from './components/ChannelSelector';
import { BrainStateDashboard } from './components/BrainStateDashboard';
import { CorrelationChart } from './components/CorrelationChart';
import { RecordingPanel } from './components/RecordingPanel';
import { SignalQualityPanel } from './components/SignalQualityPanel';
import { EegRefreshDriver } from './components/EegRefreshDriver';
import { useEEGStore } from './store/eeg';
import { ViewMode } from './types';

const navItem = (active: boolean): React.CSSProperties => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 12px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: active ? 700 : 500,
  color: active ? '#fff' : '#94a3b8',
  background: active ? '#1565c0' : 'transparent',
  boxShadow: active ? '0 2px 8px rgba(21,101,192,0.45)' : 'none',
  transition: 'all 0.2s ease',
  textAlign: 'left',
});

const App: React.FC = () => {
  const activeView = useEEGStore(s => s.activeView);
  const setView = useEEGStore(s => s.setView);

  const switchView = (view: ViewMode) => () => setView(view);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* 共享刷新驱动：切换视图不影响后台轮询 */}
      <EegRefreshDriver />
      <nav style={{ width: '220px', background: '#0d1b2a', color: '#fff', padding: '20px 0', boxShadow: '2px 0 8px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '0 16px', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '1px' }}>🧠 EEG Lab</h2>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>脑电数据分析平台</div>
        </div>
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid #1e293b', marginBottom: '4px' }}>
          <button style={navItem(activeView === 'waveform')} onClick={switchView('waveform')}>
            <span>📈</span> 波形分析
          </button>
          <button style={navItem(activeView === 'quality')} onClick={switchView('quality')}>
            <span>🩺</span> 信号质量诊断
          </button>
        </div>
        {/* 通道选择是两个视图共享的同一份状态 */}
        <ChannelSelector />
      </nav>
      <main style={{ flex: 1, overflow: 'auto', background: '#f5f7fa' }}>
        {activeView === 'quality' ? (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <SignalQualityPanel />
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 600px', minWidth: 0 }}>
              <WaveformChart />
              <BandPowerChart />
              <CorrelationChart />
            </div>
            <div style={{ flex: '0 0 340px', maxWidth: '400px' }}>
              <BrainStateDashboard />
              <RecordingPanel />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
export default App;
