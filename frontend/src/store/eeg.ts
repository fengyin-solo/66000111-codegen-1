import { create } from 'zustand';
import axios from 'axios';
import { EEGData, BandPower, BrainState, CorrelationData, Recording, RecordingFrame, PlaybackState, ViewMode, RefreshInfo } from '../types';
import { generateMockEEG, computeBandPower, computeBrainState, computeCorrelation } from '../lib/eeg-data';

const STORAGE_KEY = 'eeg_recordings';
const CHANNEL_STORAGE_KEY = 'eeg_selected_channel';
const VIEW_STORAGE_KEY = 'eeg_active_view';

const ALL_CHANNELS = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2'];

const loadRecordings = (): Recording[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecordings = (recordings: Recording[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
  } catch {}
};

const loadChannel = (): string => {
  try {
    const ch = localStorage.getItem(CHANNEL_STORAGE_KEY);
    // 兼容历史数据：只有合法通道才恢复，避免旧版本写入过未知值
    if (ch && ALL_CHANNELS.includes(ch)) return ch;
  } catch {}
  return 'Fp1';
};

const loadView = (): ViewMode => {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'quality' || v === 'waveform') return v;
  } catch {}
  return 'waveform';
};

interface EEGState {
  eegData: EEGData | null;
  selectedChannel: string;
  activeView: ViewMode;
  bandPower: BandPower | null;
  isStreaming: boolean;
  brainState: BrainState | null;
  correlationData: CorrelationData | null;
  refreshInfo: RefreshInfo;
  isRecording: boolean;
  recordingStartTime: number;
  currentRecordingFrames: RecordingFrame[];
  recordings: Recording[];
  playbackMode: boolean;
  activeRecording: Recording | null;
  playbackState: PlaybackState;
  setEEGData: (d: EEGData | null) => void;
  setChannel: (c: string) => void;
  setView: (v: ViewMode) => void;
  refreshEEG: () => Promise<void>;
  setBandPower: (b: BandPower | null) => void;
  setStreaming: (v: boolean) => void;
  setBrainState: (s: BrainState | null) => void;
  setCorrelationData: (c: CorrelationData | null) => void;
  startRecording: () => void;
  stopRecording: (name: string) => void;
  addRecordingFrame: (eeg: EEGData, bands: BandPower, brainState: BrainState, correlation: CorrelationData) => void;
  deleteRecording: (id: string) => void;
  enterPlaybackMode: (recording: Recording) => void;
  exitPlaybackMode: () => void;
  setPlaybackTime: (time: number) => void;
  togglePlayback: () => void;
  setPlaybackPlaying: (playing: boolean) => void;
}

const PLAYBACK_REFRESH_INFO: RefreshInfo = {
  status: 'success',
  source: 'playback',
  sourceLabel: '历史回放',
  message: '当前诊断基于录制的历史帧数据',
  lastSuccessAt: null,
  lastErrorAt: null,
  errorCount: 0,
  channel: '',
};

export const useEEGStore = create<EEGState>((set, get) => ({
  eegData: null,
  selectedChannel: loadChannel(),
  activeView: loadView(),
  bandPower: null,
  isStreaming: false,
  brainState: null,
  correlationData: null,
  refreshInfo: {
    status: 'idle',
    source: 'none',
    sourceLabel: '尚未刷新',
    message: '等待首次数据刷新',
    lastSuccessAt: null,
    lastErrorAt: null,
    errorCount: 0,
    channel: loadChannel(),
  },
  isRecording: false,
  recordingStartTime: 0,
  currentRecordingFrames: [],
  recordings: loadRecordings(),
  playbackMode: false,
  activeRecording: null,
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    currentFrame: null,
  },
  setEEGData: (d) => set({ eegData: d }),
  setChannel: (c) => {
    try {
      localStorage.setItem(CHANNEL_STORAGE_KEY, c);
    } catch {}
    set({ selectedChannel: c });
  },
  setView: (v) => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {}
    set({ activeView: v });
  },
  /**
   * 波形与诊断面板共享的刷新动作。
   * 任一面板（或共享轮询驱动）触发都会更新同一份数据与刷新状态，
   * 从而保证波形、诊断、录制三处看到的刷新结果完全一致。
   */
  refreshEEG: async () => {
    const state = get();
    if (state.playbackMode) return;
    const channel = state.selectedChannel;
    set({
      refreshInfo: { ...state.refreshInfo, status: 'loading', channel, message: `正在刷新 ${channel} 通道数据…` },
    });

    let eeg: EEGData | null = null;
    let bands: BandPower | null = null;
    let brainState: BrainState | null = null;
    let correlation: CorrelationData | null = null;
    let status: RefreshInfo['status'];
    let source: RefreshInfo['source'];
    let message: string;

    try {
      const { data } = await axios.get(`/api/eeg/sample/${channel}?duration=3`);
      eeg = data?.eeg ?? null;
      bands = data?.bands ?? null;
      brainState = data?.brainState ?? null;
      correlation = data?.correlation ?? null;

      const channelData = eeg?.data?.[channel];
      if (!eeg || !channelData || channelData.length === 0) {
        // 接口可达但该通道采样为空：保留上一帧有效数据，仅置空状态
        const now = Date.now();
        set((s) => ({
          refreshInfo: {
            ...s.refreshInfo,
            status: 'empty',
            source: 'server',
            sourceLabel: '后端采样',
            message: `通道 ${channel} 本次采样为空，正在保留上一次有效结果`,
            lastErrorAt: now,
            channel,
          },
        }));
        return;
      }
      status = 'success';
      source = 'server';
      message = `通道 ${channel} 数据刷新成功`;
    } catch {
      // 后端不可用时用本地模拟数据兜底（与原有行为一致），
      // 但明确标记为“降级”，刷新失败状态对用户可见，恢复后自动回到 success。
      eeg = generateMockEEG(3);
      bands = computeBandPower();
      brainState = computeBrainState(bands);
      correlation = computeCorrelation(channel, eeg);
      status = 'degraded';
      source = 'mock';
      message = '后端刷新失败，当前展示本地模拟数据';
    }

    // 过期响应保护：请求期间用户已切换通道或进入回放，则丢弃这一帧
    const latest = get();
    if (latest.playbackMode || latest.selectedChannel !== channel) return;

    latest.setEEGData(eeg);
    latest.setBandPower(bands);
    latest.setBrainState(brainState);
    latest.setCorrelationData(correlation);
    if (latest.isRecording) {
      latest.addRecordingFrame(eeg, bands!, brainState!, correlation!);
    }

    const now = Date.now();
    if (status === 'success') {
      set((s) => ({
        refreshInfo: {
          status: 'success',
          source: 'server',
          sourceLabel: '后端采样',
          message,
          lastSuccessAt: now,
          lastErrorAt: s.refreshInfo.lastErrorAt,
          errorCount: 0,
          channel,
        },
      }));
    } else {
      set((s) => ({
        refreshInfo: {
          status: 'degraded',
          source: 'mock',
          sourceLabel: '本地模拟',
          message,
          lastSuccessAt: now,
          lastErrorAt: now,
          errorCount: s.refreshInfo.errorCount + 1,
          channel,
        },
      }));
    }
  },
  setBandPower: (b) => set({ bandPower: b }),
  setStreaming: (v) => set({ isStreaming: v }),
  setBrainState: (s) => set({ brainState: s }),
  setCorrelationData: (c) => set({ correlationData: c }),
  startRecording: () => {
    set({
      isRecording: true,
      recordingStartTime: Date.now(),
      currentRecordingFrames: [],
      playbackMode: false,
      activeRecording: null,
    });
  },
  stopRecording: (name: string) => {
    const { currentRecordingFrames, recordingStartTime, selectedChannel } = get();
    if (currentRecordingFrames.length === 0) {
      set({ isRecording: false, currentRecordingFrames: [] });
      return;
    }
    const endTime = Date.now();
    const duration = (endTime - recordingStartTime) / 1000;
    const newRecording: Recording = {
      id: `rec_${endTime}`,
      name: name || `录制 ${new Date(recordingStartTime).toLocaleString()}`,
      channel: selectedChannel,
      startTime: recordingStartTime,
      endTime,
      duration,
      frames: currentRecordingFrames,
    };
    const recordings = [...get().recordings, newRecording];
    saveRecordings(recordings);
    set({
      isRecording: false,
      recordingStartTime: 0,
      currentRecordingFrames: [],
      recordings,
    });
  },
  addRecordingFrame: (eeg, bands, brainState, correlation) => {
    const { isRecording, recordingStartTime, currentRecordingFrames } = get();
    if (!isRecording) return;
    const relativeTime = (Date.now() - recordingStartTime) / 1000;
    const frame: RecordingFrame = { relativeTime, eeg, bands, brainState, correlation };
    set({ currentRecordingFrames: [...currentRecordingFrames, frame] });
  },
  deleteRecording: (id) => {
    const recordings = get().recordings.filter(r => r.id !== id);
    saveRecordings(recordings);
    const { activeRecording } = get();
    if (activeRecording?.id === id) {
      set({ recordings, playbackMode: false, activeRecording: null });
    } else {
      set({ recordings });
    }
  },
  enterPlaybackMode: (recording) => {
    if (recording.frames.length === 0) return;
    set({
      playbackMode: true,
      activeRecording: recording,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: recording.frames[0],
      },
      eegData: recording.frames[0].eeg,
      bandPower: recording.frames[0].bands,
      brainState: recording.frames[0].brainState,
      correlationData: recording.frames[0].correlation,
      refreshInfo: {
        ...PLAYBACK_REFRESH_INFO,
        channel: get().selectedChannel,
        lastSuccessAt: recording.frames[0].brainState?.timestamp ?? null,
      },
    });
  },
  exitPlaybackMode: () => {
    set((s) => ({
      playbackMode: false,
      activeRecording: null,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: null,
      },
      // 回到实时模式：恢复为待刷新态，驱动会立刻拉取一次新数据
      refreshInfo: {
        ...s.refreshInfo,
        status: 'idle',
        source: 'none',
        sourceLabel: '尚未刷新',
        message: '已退出回放，等待实时数据刷新',
      },
    }));
  },
  setPlaybackTime: (time) => {
    const { activeRecording } = get();
    if (!activeRecording || activeRecording.frames.length === 0) return;
    const frames = activeRecording.frames;
    let frameIndex = 0;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].relativeTime <= time) {
        frameIndex = i;
      } else {
        break;
      }
    }
    const frame = frames[frameIndex];
    set((s) => ({
      playbackState: {
        ...s.playbackState,
        currentTime: time,
        currentFrame: frame,
      },
      eegData: frame.eeg,
      bandPower: frame.bands,
      brainState: frame.brainState,
      correlationData: frame.correlation,
      refreshInfo: {
        ...s.refreshInfo,
        status: 'success',
        source: 'playback',
        sourceLabel: '历史回放',
        message: '当前诊断基于录制的历史帧数据',
        lastSuccessAt: frame.brainState?.timestamp ?? s.refreshInfo.lastSuccessAt,
      },
    }));
  },
  togglePlayback: () => {
    const { playbackState } = get();
    set({
      playbackState: {
        ...playbackState,
        isPlaying: !playbackState.isPlaying,
      },
    });
  },
  setPlaybackPlaying: (playing) => {
    set({
      playbackState: {
        ...get().playbackState,
        isPlaying: playing,
      },
    });
  },
}));
