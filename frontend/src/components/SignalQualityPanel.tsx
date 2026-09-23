import React, { useMemo } from 'react';
import { useEEGStore } from '../store/eeg';
import { SignalQualityReport } from '../types';
import { ALL_CHANNELS, CHANNEL_NAMES } from '../constants/channels';
import { analyzeSignalQuality } from '../utils/signalQuality';

const GRADE_COLORS: Record<SignalQualityReport['grade'], string> = {
  good: '#2e7d32',
  fair: '#ef6c00',
  poor: '#c62828',
};

const formatClock = (ts: number | null): string =>
  ts ? new Date(ts).toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--';

const Metric: React.FC<{ label: string; value: React.ReactNode; hint?: string; color?: string }> = ({ label, value, hint, color = '#333' }) => (
  <div style={{ flex: '1 1 130px', minWidth: '130px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</div>
    {hint && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{hint}</div>}
  </div>
);

const SectionCard: React.FC<{ icon: string; title: string; children: React.ReactNode; extra?: React.ReactNode }> = ({ icon, title, children, extra }) => (
  <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
    <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{title}</span>
      {extra}
    </h3>
    {children}
  </div>
);

export const SignalQualityPanel: React.FC = () => {
  const {
    selectedChannel, setChannel, setActiveView,
    eegData, dataChannel, refreshInfo, playbackMode, activeRecording,
    simulationMode, triggerRefresh, setSimulationMode,
  } = useEEGStore();

  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;
  const report = useMemo(
    () => analyzeSignalQuality(selectedChannel, eegData),
    [selectedChannel, eegData],
  );

  const status = refreshInfo.status;
  const loading = status === 'loading';
  const isError = status === 'error';
  const isEmpty = status === 'empty';
  // 直播模式下，当前数据是其它通道的旧数据时，结果标记为过期
  const stale = !playbackMode && dataChannel !== null && dataChannel !== selectedChannel;
  const sourceLabel = refreshInfo.source === 'api' ? '实时接口'
    : refreshInfo.source === 'mock' ? '离线模拟'
    : refreshInfo.source === 'playback' ? '历史回放'
    : '—';

  const handleUseMock = () => {
    setSimulationMode(true);
    triggerRefresh();
  };

  const handleRetry = () => {
    setSimulationMode(false);
    triggerRefresh();
  };

  return (
    <div>
      {/* 头部：通道选择 + 返回波形，与侧边栏共享同一份通道状态 */}
      <div style={{ padding: '16px 16px 0', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0, padding: '14px 16px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '18px' }}>🩺</span>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0d1b2a' }}>信号质量诊断</h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              关注通道 <b style={{ color: '#1565c0' }}>{selectedChannel}</b> · {channelName}
            </span>
            {playbackMode && (
              <span style={{ fontSize: '12px', color: '#6a1b9a', fontWeight: 600 }}>⏮ 回放：{activeRecording?.name}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ALL_CHANNELS.map(ch => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                title={CHANNEL_NAMES[ch]}
                style={{
                  padding: selectedChannel === ch ? '6px 12px' : '5px 10px',
                  borderRadius: '14px',
                  border: selectedChannel === ch ? '2px solid #1565c0' : '1px solid #cbd5e1',
                  background: selectedChannel === ch ? '#1565c0' : '#f8fafc',
                  color: selectedChannel === ch ? '#fff' : '#475569',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: selectedChannel === ch ? 700 : 400,
                  transition: 'all 0.2s ease',
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setActiveView('waveform')}
          style={{
            padding: '10px 16px', background: '#0d1b2a', color: '#fff', border: 'none',
            borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
          }}
        >
          ← 返回波形面板
        </button>
      </div>

      {/* 状态横幅 */}
      {loading && (
        <div style={{ margin: '16px 16px 0', padding: '12px 16px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '10px', fontSize: '13px', color: '#1565c0' }}>
          {stale ? `正在切换到 ${selectedChannel}（${channelName}），结果加载中…` : `正在刷新 ${selectedChannel} 通道数据…`}
        </div>
      )}
      {!loading && isError && (
        <div style={{ margin: '16px 16px 0', padding: '12px 16px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '10px', fontSize: '13px', color: '#c62828' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>
            ⚠ {refreshInfo.lastErrorMessage || '刷新失败'}
          </div>
          <div style={{ fontSize: '12px', color: '#8d6e63' }}>
            诊断仍展示最近一次成功结果{report ? `（${formatClock(refreshInfo.lastSuccessAt)}）` : ''}，下次刷新成功后自动更新。
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <button onClick={handleRetry} style={{ padding: '6px 14px', background: '#c62828', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              重试连接
            </button>
            <button onClick={handleUseMock} style={{ padding: '6px 14px', background: '#fff', color: '#ef6c00', border: '1px solid #ffcc80', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              🧪 使用离线模拟数据
            </button>
          </div>
        </div>
      )}
      {!loading && isEmpty && (
        <div style={{ margin: '16px 16px 0', padding: '12px 16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', fontSize: '13px', color: '#ef6c00' }}>
          ⚠ 最近一次刷新 {selectedChannel} 通道采样为空，暂无可诊断数据；系统将在下次刷新成功后自动恢复。
        </div>
      )}
      {!playbackMode && !loading && stale && !isError && !isEmpty && (
        <div style={{ margin: '16px 16px 0', padding: '10px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', color: '#64748b' }}>
          以下结果来自 {dataChannel} 通道的上一次刷新，等待 {selectedChannel} 的新数据到达后自动更新。
        </div>
      )}
      {!playbackMode && simulationMode && !isError && (
        <div style={{ margin: '16px 16px 0', padding: '8px 16px', background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '10px', fontSize: '12px', color: '#ef6c00' }}>
          🧪 当前为离线模拟数据，仅供界面演示。
          <button onClick={handleRetry} style={{ marginLeft: '8px', padding: '2px 10px', background: '#fff', color: '#ef6c00', border: '1px solid #ffcc80', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
            恢复实时连接
          </button>
        </div>
      )}

      {!report ? (
        <SectionCard icon="📭" title={`${selectedChannel} · 暂无可诊断数据`}>
          <div style={{ color: '#999', padding: '48px 0', textAlign: 'center', fontSize: '13px' }}>
            {playbackMode
              ? '当前回放帧不包含该通道的采样数据，请选择其它通道或录制。'
              : loading
                ? '正在等待首个采样…'
                : isEmpty
                  ? '最近一次刷新返回的采样为空。'
                  : '尚无采样数据，请等待刷新或检查数据服务。'}
          </div>
        </SectionCard>
      ) : (
        <>
          {/* 总览 + 采样完整性 */}
          <SectionCard
            icon="🧮"
            title="采样完整性"
            extra={
              <span style={{
                fontSize: '13px', fontWeight: 700, color: '#fff',
                background: GRADE_COLORS[report.grade], borderRadius: '12px', padding: '3px 12px',
              }}>
                质量评分 {report.score} · {report.gradeLabel}
              </span>
            }
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <Metric
                label="采样完整率"
                value={`${(report.completenessRatio * 100).toFixed(1)}%`}
                hint={`${report.sampleCount} / 预期 ${report.expectedSamples} 点`}
                color={report.completenessRatio >= 0.999 ? '#2e7d32' : report.completenessRatio >= 0.95 ? '#ef6c00' : '#c62828'}
              />
              <Metric label="缺失采样" value={report.missingSamples} hint={`按 ${report.sampleRate} Hz × ${report.durationSec.toFixed(1)}s 估算`} color={report.missingSamples > 0 ? '#ef6c00' : '#2e7d32'} />
              <Metric label="无效值（NaN/∞）" value={report.invalidSampleCount} hint={`占 ${(report.invalidRatio * 100).toFixed(2)}%`} color={report.invalidSampleCount > 0 ? '#c62828' : '#2e7d32'} />
              <Metric label="最长平直段" value={`${(report.longestFlatRun / report.sampleRate).toFixed(2)} s`} hint={report.flatRuns.length > 0 ? `共 ${report.flatRuns.length} 段信号停滞` : '无停滞'} color={report.flatRuns.length > 0 ? '#ef6c00' : '#2e7d32'} />
              <Metric label="峰峰值 / 标准差" value={`${report.peakToPeak.toFixed(2)} / ${report.std.toFixed(3)}`} hint={`均值 ${report.mean.toFixed(3)}`} />
            </div>

            {report.flatRuns.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>平直采样段明细</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {report.flatRuns.slice(0, 8).map((run, i) => (
                    <span key={i} style={{ fontSize: '11px', padding: '3px 8px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', color: '#ef6c00' }}>
                      {run.startTime.toFixed(2)}s–{run.endTime.toFixed(2)}s · {run.length}点
                    </span>
                  ))}
                  {report.flatRuns.length > 8 && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', padding: '3px 4px' }}>等共 {report.flatRuns.length} 段</span>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* 异常波动段 */}
          <SectionCard icon="⚡" title={`异常波动段（${report.anomalySegments.length}）`}>
            {report.anomalySegments.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#2e7d32', fontSize: '13px', background: '#f1f8e9', borderRadius: '8px' }}>
                ✅ 未发现超过 ±3σ 的异常波动
              </div>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  异常采样占比 <b>{(report.anomalyRatio * 100).toFixed(1)}%</b>，下列区段幅度显著偏离基线：
                </div>
                <div style={{ maxHeight: '260px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {report.anomalySegments.map((seg, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                      borderRadius: '8px', border: '1px solid',
                      borderColor: seg.kind === 'spike' ? '#ef9a9a' : '#ffe0b2',
                      background: seg.kind === 'spike' ? '#ffebee' : '#fff8e1',
                      fontSize: '12px',
                    }}>
                      <span style={{ fontWeight: 700, color: seg.kind === 'spike' ? '#c62828' : '#ef6c00', minWidth: '56px' }}>
                        {seg.kind === 'spike' ? '尖峰' : '异常'}
                      </span>
                      <span style={{ color: '#334155', minWidth: '150px' }}>
                        {seg.startTime.toFixed(3)}s – {seg.endTime.toFixed(3)}s
                      </span>
                      <span style={{ color: '#64748b' }}>持续 {seg.durationMs} ms</span>
                      <span style={{ color: '#64748b' }}>峰值 {seg.peakAmplitude.toFixed(2)}</span>
                      <span style={{ color: seg.kind === 'spike' ? '#c62828' : '#ef6c00', fontWeight: 600, marginLeft: 'auto' }}>
                        z = {seg.maxZScore.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          {/* 最近一次刷新结果 + 诊断结论 */}
          <SectionCard icon="🔄" title="最近一次刷新结果">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <Metric label="刷新状态" value={
                <span style={{ color: status === 'success' ? '#2e7d32' : status === 'error' ? '#c62828' : status === 'empty' ? '#ef6c00' : '#1565c0' }}>
                  {status === 'success' ? '成功' : status === 'error' ? '失败' : status === 'empty' ? '采样为空' : status === 'loading' ? '刷新中' : '空闲'}
                </span>
              } hint={playbackMode ? '回放帧切换即为一次刷新' : '每 3 秒自动刷新'} />
              <Metric label="数据来源" value={sourceLabel} hint={playbackMode && activeRecording ? activeRecording.name : simulationMode ? '本地生成' : '后端 /api/eeg/sample'} />
              <Metric label="成功时间" value={formatClock(refreshInfo.lastSuccessAt)} hint="诊断结果对应的数据时刻" />
              <Metric label="失败时间" value={formatClock(refreshInfo.lastErrorAt)} hint={refreshInfo.lastErrorMessage || '暂无错误'} color={refreshInfo.lastErrorAt ? '#c62828' : '#2e7d32'} />
              <Metric label="诊断计算时间" value={formatClock(report.computedAt)} hint={`基于 ${report.sampleCount} 个采样点`} />
            </div>

            <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '8px', background: `${GRADE_COLORS[report.grade]}0d`, border: `1px solid ${GRADE_COLORS[report.grade]}55` }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: GRADE_COLORS[report.grade], marginBottom: '6px' }}>诊断结论</div>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                {report.notes.map((note, i) => (
                  <li key={i} style={{ fontSize: '12px', color: '#475569', lineHeight: 1.7 }}>{note}</li>
                ))}
              </ul>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
};
