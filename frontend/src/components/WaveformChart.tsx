import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { CHANNEL_NAMES } from '../lib/eeg-data';

export const WaveformChart: React.FC = () => {
  const {
    eegData, selectedChannel, isRecording, playbackMode, refreshInfo,
  } = useEEGStore();

  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;
  const channelData = eegData?.data[selectedChannel];
  const isEmpty = !channelData || channelData.length === 0;

  const chartData = channelData?.map((v: number, i: number) => ({
    t: eegData?.time[i]?.toFixed(3), value: Number.isFinite(v) ? Number(v.toFixed(4)) : null
  })) || [];

  const isLoading = refreshInfo.status === 'loading' && !playbackMode;
  const isDegraded = refreshInfo.status === 'degraded' && !playbackMode;
  const isEmptyRefresh = refreshInfo.status === 'empty' && !playbackMode;

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
          <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放模式</span>
        )}
        {isLoading && <span style={{ fontSize: '12px', color: '#999' }}>刷新中...</span>}
        {isDegraded && (
          <span title={refreshInfo.message} style={{ fontSize: '12px', color: '#e65100', fontWeight: 500, background: '#fff3e0', padding: '2px 8px', borderRadius: '10px' }}>
            ⚠️ 刷新失败·模拟数据
          </span>
        )}
        {isEmptyRefresh && (
          <span style={{ fontSize: '12px', color: '#c62828', fontWeight: 500, background: '#ffebee', padding: '2px 8px', borderRadius: '10px' }}>
            📭 本次采样为空
          </span>
        )}
      </h3>
      {isEmpty ? (
        <div style={{ color: '#999', padding: '60px 0', textAlign: 'center', fontSize: '13px' }}>
          {playbackMode
            ? '回放帧中不存在该通道数据'
            : `通道 ${selectedChannel} 暂无可展示的采样数据，等待下一次刷新…`}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
            <Line
              type="monotone" dataKey="value"
              stroke={isDegraded ? '#ef6c00' : '#1565c0'}
              dot={false} strokeWidth={1.5}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
