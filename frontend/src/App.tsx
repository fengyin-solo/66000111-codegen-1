import React from 'react';
import { WaveformChart } from './components/WaveformChart';
import { BandPowerChart } from './components/BandPowerChart';
import { ChannelSelector } from './components/ChannelSelector';
import { BrainStateDashboard } from './components/BrainStateDashboard';
import { CorrelationChart } from './components/CorrelationChart';
import { RecordingPanel } from './components/RecordingPanel';
import { SignalQualityPanel } from './components/SignalQualityPanel';
import { useEEGRefresh } from './hooks/useEEGRefresh';
import { useEEGStore } from './store/eeg';

const NAV_ITEMS: { key: 'waveform' | 'diagnostics'; icon: string; label: string; desc: string }[] = [
  { key: 'waveform', icon: '📈', label: '波形面板', desc: '实时/回放波形' },
  { key: 'diagnostics', icon: '🩺', label: '质量诊断', desc: '采样与异常检测' },
];

const App: React.FC = () => {
  useEEGRefresh();
  const activeView = useEEGStore(s => s.activeView);
  const setActiveView = useEEGStore(s => s.setActiveView);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <nav style={{ width: '220px', background: '#0d1b2a', color: '#fff', padding: '20px 0', boxShadow: '2px 0 8px rgba(0,0,0,0.1)', overflowY: 'auto' }}>
        <div style={{ padding: '0 16px', marginBottom: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '1px' }}>🧠 EEG Lab</h2>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>脑电数据分析平台</div>
        </div>

        {/* 视图切换：诊断与波形共享同一份通道状态，选择在重进时保留 */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(item => {
            const active = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 12px',
                  borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                  border: active ? '1px solid #64b5f6' : '1px solid transparent',
                  background: active ? 'rgba(21, 101, 192, 0.25)' : 'transparent',
                  color: active ? '#fff' : '#94a3b8',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: active ? 700 : 500 }}>{item.label}</span>
                  <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '1px' }}>{item.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <ChannelSelector />
      </nav>
      <main style={{ flex: 1, overflow: 'auto', background: '#f5f7fa' }}>
        {activeView === 'diagnostics' ? (
          <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '24px' }}>
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
