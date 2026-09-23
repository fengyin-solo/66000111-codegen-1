import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useEEGStore } from '../store/eeg';
import { BandPower, BrainState, CorrelationData, EEGData } from '../types';
import { isKnownChannel } from '../constants/channels';
import {
  computeBandPower,
  computeBrainState,
  computeCorrelation,
  generateMockEEG,
} from '../utils/mockData';

const REFRESH_INTERVAL_MS = 3000;

/** 判断返回体是否为该通道的有效采样 */
const resolveSample = (payload: any, channel: string): {
  eeg: EEGData;
  bands: BandPower;
  brainState: BrainState;
  correlation: CorrelationData;
} | null => {
  const eeg = payload?.eeg as EEGData | undefined;
  if (!eeg || !Array.isArray(eeg.channels)) return null;
  const series = eeg.data?.[channel];
  if (!series || !Array.isArray(series) || series.length === 0) return null;
  if (!payload.bands || !payload.brainState || !payload.correlation) return null;
  return {
    eeg,
    bands: payload.bands as BandPower,
    brainState: payload.brainState as BrainState,
    correlation: payload.correlation as CorrelationData,
  };
};

/**
 * 波形与信号质量诊断共享的数据刷新循环：
 * - 直播模式下每 3s 拉取一次，通道切换或手动重试时立即拉取；
 * - 回放模式下由 RecordingPanel 驱动历史帧，不发请求；
 * - 刷新成功后写入 eegData，诊断面板据此自动重算；
 * - 刷新失败 / 采样为空时保留上一份数据并写入明确的 refreshInfo。
 */
export const useEEGRefresh = () => {
  const selectedChannel = useEEGStore(s => s.selectedChannel);
  const playbackMode = useEEGStore(s => s.playbackMode);
  const refreshNonce = useEEGStore(s => s.refreshNonce);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (playbackMode) return;

    let cancelled = false;

    const refresh = async () => {
      const state = useEEGStore.getState();
      if (state.playbackMode) return;
      const channel = state.selectedChannel;
      if (!isKnownChannel(channel)) return;

      const requestId = ++requestIdRef.current;
      state.setRefreshInfo({ status: 'loading', channel });

      // 离线模拟模式：本地生成数据，不请求后端
      if (state.simulationMode) {
        const eeg = generateMockEEG(3);
        const bands = computeBandPower();
        const brainState = computeBrainState(bands);
        const correlation = computeCorrelation(channel, eeg);
        if (cancelled || requestId !== requestIdRef.current || useEEGStore.getState().selectedChannel !== channel) return;
        useEEGStore.setState({ dataChannel: channel });
        state.setEEGData(eeg);
        state.setBandPower(bands);
        state.setBrainState(brainState);
        state.setCorrelationData(correlation);
        state.setRefreshInfo({
          status: 'success',
          source: 'mock',
          channel,
          lastSuccessAt: Date.now(),
        });
        if (state.isRecording) state.addRecordingFrame(eeg, bands, brainState, correlation);
        return;
      }

      try {
        const { data: payload } = await axios.get(`/api/eeg/sample/${channel}?duration=3`);
        if (cancelled || requestId !== requestIdRef.current) return;
        // 通道已切换：丢弃过期响应，由新一轮请求接管
        if (useEEGStore.getState().selectedChannel !== channel) return;

        const sample = resolveSample(payload, channel);
        if (!sample) {
          // 采样为空：保留上一份波形，但给出明确的空状态
          state.setRefreshInfo({
            status: 'empty',
            channel,
          });
          return;
        }

        state.setEEGData(sample.eeg);
        useEEGStore.setState({ dataChannel: channel });
        state.setBandPower(sample.bands);
        state.setBrainState(sample.brainState);
        state.setCorrelationData(sample.correlation);
        state.setRefreshInfo({
          status: 'success',
          source: 'api',
          channel,
          lastSuccessAt: Date.now(),
          lastErrorMessage: null,
        });
        if (state.isRecording) {
          state.addRecordingFrame(sample.eeg, sample.bands, sample.brainState, sample.correlation);
        }
      } catch (err: any) {
        if (cancelled || requestId !== requestIdRef.current) return;
        if (useEEGStore.getState().selectedChannel !== channel) return;
        // 刷新失败：保留上一份数据，诊断面板继续展示最近一次成功结果并提示错误
        state.setRefreshInfo({
          status: 'error',
          channel,
          lastErrorAt: Date.now(),
          lastErrorMessage: err?.message
            ? `数据刷新失败：${err.message}`
            : '数据刷新失败，请检查后端服务',
        });
      }
    };

    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedChannel, playbackMode, refreshNonce]);
};
