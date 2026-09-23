import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { CHANNEL_NAMES } from '../constants/channels';

export const WaveformChart: React.FC = () => {
  const {
    eegData, selectedChannel, dataChannel,
    isRecording, playbackMode, activeRecording,
    refreshInfo, simulationMode,
  } = useEEGStore();

  const channelData = eegData?.data[selectedChannel];
  const isStale = !playbackMode && dataChannel !== null && dataChannel !== selectedChannel;

  const chartData = eegData && channelData
    ? channelData.map((v: number, i: number) => ({
        t: eegData.time[i]?.toFixed(3), value: v.toFixed(4)
      }))
    : [];

  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;
  const loading = refreshInfo.status === 'loading';
  const isEmpty = refreshInfo.status === 'empty';
  const isError = refreshInfo.status === 'error';

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '20px' }}>📈</span>
        <span>{selectedChannel}</span>
        <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{channelName} · 波形图</span>
        {isRecording && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d32f2f', animation: 'pulse 1s infinite' }} />
            录制中
          </span>
        )}
        {playbackMode && (
          <span style={{ fontSize: '12px', color: '#6a1b9a', fontWeight: 500 }}>⏮ 回放模式{activeRecording ? ` · ${activeRecording.name}` : ''}</span>
        )}
        {!playbackMode && simulationMode && (
          <span style={{ fontSize: '12px', color: '#ef6c00', fontWeight: 500 }}>🧪 离线模拟数据</span>
        )}
        {!playbackMode && loading && <span style={{ fontSize: '12px', color: '#999' }}>{isStale ? '通道切换中，正在刷新...' : '刷新中...'}</span>}
        {!playbackMode && isEmpty && <span style={{ fontSize: '12px', color: '#ef6c00', fontWeight: 500 }}>⚠ 最近一次采样为空</span>}
        {!playbackMode && isError && <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>⚠ 刷新失败，显示上一次数据</span>}
      </h3>

      {!playbackMode && isError && refreshInfo.lastErrorMessage && (
        <div style={{ marginBottom: '10px', padding: '8px 12px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', fontSize: '12px', color: '#c62828' }}>
          {refreshInfo.lastErrorMessage}
        </div>
      )}
      {!playbackMode && isEmpty && (
        <div style={{ marginBottom: '10px', padding: '8px 12px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', fontSize: '12px', color: '#ef6c00' }}>
          {selectedChannel} 通道最近一次刷新没有返回采样数据，请稍后自动重试或检查设备连接。
        </div>
      )}

      {chartData.length === 0 ? (
        <div style={{ color: '#999', padding: '60px 0', textAlign: 'center' }}>
          {playbackMode ? '当前回放帧没有该通道的波形数据' : '暂无波形数据'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
            <Line type="monotone" dataKey="value" stroke={isError ? '#ef6c00' : '#1565c0'} dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
