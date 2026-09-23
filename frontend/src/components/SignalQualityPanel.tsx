import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { computeSignalQuality, buildAnomalySampleSet, MAX_ANOMALY_DISPLAY } from '../lib/signalQuality';
import { ALL_CHANNELS, CHANNEL_NAMES } from '../lib/eeg-data';
import { RefreshStatus } from '../types';

const cardStyle: React.CSSProperties = {
  padding: '16px',
  background: '#fff',
  borderRadius: '12px',
  margin: '16px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const gradeColor = (grade: string): string => {
  if (grade === 'good') return '#2e7d32';
  if (grade === 'fair') return '#f9a825';
  if (grade === 'poor') return '#e65100';
  return '#c62828';
};

const formatClock = (ts: number | null): string =>
  ts ? new Date(ts).toLocaleTimeString('zh-CN', { hour12: false }) : '—';

const statusMeta: Record<RefreshStatus, { label: string; color: string; bg: string; icon: string }> = {
  idle: { label: '待刷新', color: '#757575', bg: '#f5f5f5', icon: '⏳' },
  loading: { label: '刷新中', color: '#1565c0', bg: '#e3f2fd', icon: '🔄' },
  success: { label: '刷新成功', color: '#2e7d32', bg: '#e8f5e9', icon: '✅' },
  degraded: { label: '刷新失败·模拟兜底', color: '#e65100', bg: '#fff3e0', icon: '⚠️' },
  empty: { label: '采样为空', color: '#c62828', bg: '#ffebee', icon: '📭' },
  error: { label: '刷新失败', color: '#c62828', bg: '#ffebee', icon: '❌' },
};

const MetricRow: React.FC<{ label: string; value: React.ReactNode; warn?: boolean }> = ({ label, value, warn }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}>
    <span style={{ fontSize: '12px', color: '#666' }}>{label}</span>
    <span style={{ fontSize: '13px', fontWeight: 600, color: warn ? '#c62828' : '#333' }}>{value}</span>
  </div>
);

export const SignalQualityPanel: React.FC = () => {
  const {
    eegData, selectedChannel, setChannel, refreshInfo, refreshEEG,
    playbackMode, activeRecording, playbackState,
  } = useEEGStore();

  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;
  const report = useMemo(
    () => computeSignalQuality(eegData, selectedChannel),
    [eegData, selectedChannel],
  );

  const miniData = useMemo(() => {
    if (!report || !eegData) return [];
    const raw = eegData.data[selectedChannel] || [];
    const anomalySet = buildAnomalySampleSet(report);
    return raw.map((v, i) => ({
      t: eegData.time[i]?.toFixed(2) ?? String(i),
      normal: Number.isFinite(v) && !anomalySet.has(i) ? Number(v.toFixed(4)) : null,
      anomaly: Number.isFinite(v) && anomalySet.has(i) ? Number(v.toFixed(4)) : null,
    }));
  }, [report, eegData, selectedChannel]);

  const liveStatus = statusMeta[refreshInfo.status];
  const hasData = !!report;

  // 非回放模式下的特殊状态：首次加载中 / 完全无数据
  const showInitialLoading = !playbackMode && !hasData && refreshInfo.status === 'loading';
  const showInitialEmpty = !playbackMode && !hasData && refreshInfo.status === 'empty';
  const showInitialError = !playbackMode && !hasData && (refreshInfo.status === 'error' || refreshInfo.status === 'idle');

  return (
    <div>
      {/* 标题与整体刷新状态 */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '20px' }}>🩺</span>
          <span>{selectedChannel}</span>
          <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{channelName} · 信号质量诊断</span>
          {playbackMode && (
            <span style={{ fontSize: '12px', color: '#6a1b9a', fontWeight: 500, background: '#f3e5f5', padding: '2px 8px', borderRadius: '10px' }}>
              ⏮ 回放模式 · {activeRecording?.name}
            </span>
          )}
          {!playbackMode && (
            <span style={{
              fontSize: '12px', fontWeight: 500, color: liveStatus.color,
              background: liveStatus.bg, padding: '2px 8px', borderRadius: '10px',
            }}>
              {liveStatus.icon} {liveStatus.label}
            </span>
          )}
        </h3>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
          🔗 与波形图共享同一份通道状态：在本面板或左侧切换通道，波形图与诊断结果同步更新。
        </div>

        {/* 通道快速选择 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ALL_CHANNELS.map(ch => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              title={CHANNEL_NAMES[ch]}
              style={{
                padding: selectedChannel === ch ? '7px 13px' : '5px 11px',
                borderRadius: '16px',
                border: selectedChannel === ch ? '2px solid #64b5f6' : '1px solid #d0d7de',
                background: selectedChannel === ch ? '#1565c0' : '#fff',
                color: selectedChannel === ch ? '#fff' : '#546e7a',
                cursor: 'pointer',
                fontSize: selectedChannel === ch ? '13px' : '12px',
                fontWeight: selectedChannel === ch ? 700 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              {ch}
            </button>
          ))}
        </div>

        {/* 实时模式状态横幅 */}
        {!playbackMode && (
          <div style={{ marginTop: '12px' }}>
            {refreshInfo.status === 'degraded' && (
              <div style={{ padding: '10px 12px', background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '8px', fontSize: '12px', color: '#e65100', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>⚠️ 最近一次刷新失败（连续 {refreshInfo.errorCount} 次），当前保留/使用本地模拟数据。后端恢复后将自动恢复实时诊断。</span>
                <button onClick={() => refreshEEG()} style={{ padding: '4px 12px', background: '#e65100', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>立即重试</button>
              </div>
            )}
            {refreshInfo.status === 'empty' && hasData && (
              <div style={{ padding: '10px 12px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', fontSize: '12px', color: '#c62828' }}>
                📭 本次刷新通道 {refreshInfo.channel} 采样为空，以下为上一次有效结果，将在恢复采样后自动更新。
              </div>
            )}
            {refreshInfo.status === 'loading' && hasData && (
              <div style={{ padding: '10px 12px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px', fontSize: '12px', color: '#1565c0' }}>
                🔄 正在刷新 {refreshInfo.channel} 通道数据…
              </div>
            )}
          </div>
        )}
      </div>

      {/* 首次加载 / 空 / 失败 状态 */}
      {showInitialLoading && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#1565c0', padding: '48px 16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔄</div>
          正在获取 {selectedChannel}（{channelName}）通道数据…
        </div>
      )}
      {showInitialEmpty && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#c62828', padding: '48px 16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>通道 {selectedChannel} 采样为空</div>
          <div style={{ fontSize: '12px', color: '#999' }}>该通道暂时没有采样数据，请切换其他通道或等待下一次刷新</div>
        </div>
      )}
      {showInitialError && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#757575', padding: '48px 16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
          <div style={{ fontSize: '13px' }}>等待 {selectedChannel} 通道的首次数据…</div>
        </div>
      )}

      {hasData && report && (
        <>
          {/* 采样完整性 */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🧮</span>
              采样完整性
              <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, color: '#fff', background: gradeColor(report.grade) }}>
                {report.gradeLabel}
              </span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '14px' }}>
              <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#eceff1" strokeWidth="9" />
                  <circle
                    cx="48" cy="48" r="40" fill="none"
                    stroke={gradeColor(report.grade)} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40 * report.completeness} ${2 * Math.PI * 40}`}
                    transform="rotate(-90 48 48)"
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: gradeColor(report.grade) }}>{(report.completeness * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: '10px', color: '#999' }}>完整率</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricRow label="期望采样点数" value={`${report.expectedSamples} 点`} />
                <MetricRow label="实际接收点数" value={`${report.receivedSamples} 点`} />
                <MetricRow label="缺失点数" value={`${report.missingSamples} 点`} warn={report.missingSamples > 0} />
                <MetricRow label="无效点（NaN/非数值）" value={`${report.invalidSamples} 点`} warn={report.invalidSamples > 0} />
                <MetricRow label="采样率 / 时长" value={`${report.sampleRate} Hz · ${report.duration.toFixed(1)} s`} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { label: '均值', value: report.mean.toFixed(3) },
                { label: '标准差', value: report.std.toFixed(3) },
                { label: '峰值幅度', value: report.maxAmplitude.toFixed(3) },
              ].map(s => (
                <div key={s.label} style={{ flex: '1 1 90px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#888' }}>{s.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#37474f' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 异常波动段 */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              异常波动段
              <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: report.anomalyCount > 0 ? '#c62828' : '#2e7d32' }}>
                {report.anomalyCount > 0 ? `检出 ${report.anomalyCount} 段` : '未检出明显异常'}
              </span>
            </h3>
            <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
              判定规则：偏离均值超过 3.5 个标准差的尖峰骤变，或连续 ≥40 点无变化的平台/削顶段
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={miniData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <XAxis dataKey="t" tick={{ fontSize: 9 }} interval="preserveStartEnd" minTickGap={60} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => [v?.toFixed(4), '幅度']} labelFormatter={(l) => `t=${l}s`} />
                <Line type="monotone" dataKey="normal" stroke="#90a4ae" dot={false} strokeWidth={1.2} isAnimationActive={false} />
                <Line type="monotone" dataKey="anomaly" stroke="#d32f2f" strokeWidth={1.8} dot={{ r: 1.6, fill: '#d32f2f', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>

            {report.anomalySegments.length > 0 ? (
              <div style={{ maxHeight: '220px', overflow: 'auto', marginTop: '10px' }}>
                {report.anomalySegments.slice(0, MAX_ANOMALY_DISPLAY).map((seg, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                    borderRadius: '8px', marginBottom: '6px',
                    background: seg.type === 'flat' ? '#fce4ec' : '#fff8e1',
                    border: `1px solid ${seg.type === 'flat' ? '#f48fb1' : '#ffe082'}`,
                  }}>
                    <span style={{ fontSize: '16px' }}>{seg.type === 'flat' ? '📏' : '🔺'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>
                        {seg.typeLabel} · {seg.startTime.toFixed(2)}s – {seg.endTime.toFixed(2)}s
                      </div>
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        采样 #{seg.startSample}–#{seg.endSample} · 持续 {seg.duration.toFixed(3)}s
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#c62828', whiteSpace: 'nowrap' }}>
                      峰 {seg.peakAmplitude.toFixed(2)}
                    </div>
                  </div>
                ))}
                {report.anomalySegments.length > MAX_ANOMALY_DISPLAY && (
                  <div style={{ fontSize: '11px', color: '#999', textAlign: 'center', padding: '4px' }}>
                    仅显示前 {MAX_ANOMALY_DISPLAY} 段，共 {report.anomalySegments.length} 段
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '14px', textAlign: 'center', color: '#2e7d32', fontSize: '13px', background: '#f1f8e9', borderRadius: '8px', marginTop: '10px' }}>
                ✅ 当前窗口内波形平稳，无尖峰骤变或长时平段
              </div>
            )}
          </div>

          {/* 最近一次刷新结果 */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🛰️</span>
              最近一次刷新结果
            </h3>
            {playbackMode ? (
              <div style={{ padding: '12px', background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: '8px' }}>
                <MetricRow label="数据来源" value="📼 历史回放帧" />
                <MetricRow label="录制名称" value={activeRecording?.name ?? '—'} />
                <MetricRow label="回放进度" value={`${playbackState.currentTime.toFixed(1)}s / ${activeRecording?.duration.toFixed(1)}s`} />
                <MetricRow label="帧时间戳" value={formatClock(refreshInfo.lastSuccessAt)} />
                <div style={{ fontSize: '11px', color: '#7b1fa2', marginTop: '8px' }}>
                  实时刷新已暂停，诊断结果随回放进度自动更新；退出回放后恢复实时刷新。
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  borderRadius: '8px', marginBottom: '10px',
                  background: liveStatus.bg, border: `1px solid ${liveStatus.color}33`,
                }}>
                  <span style={{ fontSize: '18px' }}>{liveStatus.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: liveStatus.color }}>{liveStatus.label}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{refreshInfo.message}</div>
                  </div>
                  <button
                    onClick={() => refreshEEG()}
                    disabled={refreshInfo.status === 'loading'}
                    style={{
                      padding: '5px 12px', background: refreshInfo.status === 'loading' ? '#b0bec5' : '#1565c0',
                      color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: refreshInfo.status === 'loading' ? 'default' : 'pointer',
                    }}
                  >
                    {refreshInfo.status === 'loading' ? '刷新中' : '🔄 立即刷新'}
                  </button>
                </div>
                <MetricRow label="数据来源" value={refreshInfo.source === 'server' ? '🟢 后端实时采样' : refreshInfo.source === 'mock' ? '🟠 本地模拟兜底' : '—'} />
                <MetricRow label="对应通道" value={refreshInfo.channel || selectedChannel} />
                <MetricRow label="最近成功时间" value={formatClock(refreshInfo.lastSuccessAt)} />
                <MetricRow label="最近失败时间" value={formatClock(refreshInfo.lastErrorAt)} warn={refreshInfo.lastErrorAt !== null} />
                <MetricRow label="连续失败次数" value={`${refreshInfo.errorCount} 次`} warn={refreshInfo.errorCount > 0} />
                <MetricRow label="自动刷新周期" value="3 秒" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
