import { create } from 'zustand';
import { EEGData, BandPower, BrainState, CorrelationData, Recording, RecordingFrame, PlaybackState, RefreshInfo } from '../types';
import { ALL_CHANNELS } from '../constants/channels';

const STORAGE_KEY = 'eeg_recordings';
const UI_STORAGE_KEY = 'eeg_ui_state';

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

type ActiveView = 'waveform' | 'diagnostics';

interface UIState {
  selectedChannel: string;
  activeView: ActiveView;
}

const loadUIState = (): UIState => {
  const fallback: UIState = { selectedChannel: 'Fp1', activeView: 'waveform' };
  try {
    const stored = localStorage.getItem(UI_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return {
      selectedChannel: ALL_CHANNELS.includes(parsed.selectedChannel) ? parsed.selectedChannel : fallback.selectedChannel,
      activeView: parsed.activeView === 'diagnostics' ? 'diagnostics' : 'waveform',
    };
  } catch {
    return fallback;
  }
};

const saveUIState = (state: UIState) => {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(state));
  } catch {}
};

const idleRefreshInfo: RefreshInfo = {
  status: 'idle',
  source: null,
  channel: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
};

interface EEGState {
  eegData: EEGData | null;
  selectedChannel: string;
  /** 当前 eegData 实际对应的通道，用于通道切换后识别过期结果 */
  dataChannel: string | null;
  bandPower: BandPower | null;
  isStreaming: boolean;
  brainState: BrainState | null;
  correlationData: CorrelationData | null;
  isRecording: boolean;
  recordingStartTime: number;
  currentRecordingFrames: RecordingFrame[];
  recordings: Recording[];
  playbackMode: boolean;
  activeRecording: Recording | null;
  playbackState: PlaybackState;
  /** 当前主面板视图：波形 / 信号质量诊断，返回或重进时保持选择 */
  activeView: ActiveView;
  /** 波形与诊断共享的最近一次刷新结果 */
  refreshInfo: RefreshInfo;
  /** 离线模拟模式：接口不可用时由用户显式开启 */
  simulationMode: boolean;
  /** 用于触发立即重新刷新（通道切换 / 手动重试时自增） */
  refreshNonce: number;
  setEEGData: (d: EEGData | null) => void;
  setChannel: (c: string) => void;
  setBandPower: (b: BandPower | null) => void;
  setStreaming: (v: boolean) => void;
  setBrainState: (s: BrainState | null) => void;
  setCorrelationData: (c: CorrelationData | null) => void;
  setActiveView: (v: ActiveView) => void;
  setRefreshInfo: (info: Partial<RefreshInfo>) => void;
  setSimulationMode: (v: boolean) => void;
  triggerRefresh: () => void;
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

const initialUI = loadUIState();

export const useEEGStore = create<EEGState>((set, get) => ({
  eegData: null,
  selectedChannel: initialUI.selectedChannel,
  dataChannel: null,
  bandPower: null,
  isStreaming: false,
  brainState: null,
  correlationData: null,
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
  activeView: initialUI.activeView,
  refreshInfo: idleRefreshInfo,
  simulationMode: false,
  refreshNonce: 0,
  setEEGData: (d) => set({ eegData: d }),
  setChannel: (c) => {
    const { selectedChannel, playbackMode } = get();
    if (c === selectedChannel) return;
    set({
      selectedChannel: c,
      // 直播模式下切换通道：新数据到达前旧诊断结果标记为过期/加载中；
      // 回放模式下继续展示历史帧数据，不标记为加载。
      refreshInfo: playbackMode
        ? { ...get().refreshInfo, channel: c }
        : {
            ...get().refreshInfo,
            status: 'loading',
            channel: c,
            lastErrorMessage: null,
          },
    });
    saveUIState({ selectedChannel: c, activeView: get().activeView });
  },
  setBandPower: (b) => set({ bandPower: b }),
  setStreaming: (v) => set({ isStreaming: v }),
  setBrainState: (s) => set({ brainState: s }),
  setCorrelationData: (c) => set({ correlationData: c }),
  setActiveView: (v) => {
    set({ activeView: v });
    saveUIState({ selectedChannel: get().selectedChannel, activeView: v });
  },
  setRefreshInfo: (info) => set({ refreshInfo: { ...get().refreshInfo, ...info } }),
  setSimulationMode: (v) => set({ simulationMode: v }),
  triggerRefresh: () => {
    if (get().playbackMode) return;
    set({
      refreshNonce: get().refreshNonce + 1,
      refreshInfo: { ...get().refreshInfo, status: 'loading', lastErrorMessage: null },
    });
  },
  startRecording: () => {
    const { selectedChannel } = get();
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
    const firstFrame = recording.frames[0];
    set({
      playbackMode: true,
      activeRecording: recording,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: firstFrame,
      },
      eegData: firstFrame.eeg,
      dataChannel: recording.channel,
      bandPower: firstFrame.bands,
      brainState: firstFrame.brainState,
      correlationData: firstFrame.correlation,
      refreshInfo: {
        status: 'success',
        source: 'playback',
        channel: recording.channel,
        lastSuccessAt: Date.now(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });
  },
  exitPlaybackMode: () => {
    set({
      playbackMode: false,
      activeRecording: null,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: null,
      },
      refreshInfo: {
        ...get().refreshInfo,
        status: 'loading',
        source: null,
      },
    });
    get().triggerRefresh();
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
    set({
      playbackState: {
        ...get().playbackState,
        currentTime: time,
        currentFrame: frame,
      },
      eegData: frame.eeg,
      dataChannel: activeRecording.channel,
      bandPower: frame.bands,
      brainState: frame.brainState,
      correlationData: frame.correlation,
      refreshInfo: {
        status: 'success',
        source: 'playback',
        channel: activeRecording.channel,
        lastSuccessAt: Date.now(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });
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
