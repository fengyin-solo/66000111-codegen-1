export interface EEGData { channels: string[]; sample_rate: number; data: Record<string, number[]>; time: number[]; duration: number; }
export interface BandPower { delta: number; theta: number; alpha: number; beta: number; gamma: number; }
export interface BrainState {
  focus: number;
  relaxation: number;
  fatigue: number;
  status: 'focused' | 'relaxed' | 'fatigued' | 'neutral';
  statusLabel: string;
  statusColor: string;
  timestamp: number;
}
export interface ChannelCorrelation {
  channel: string;
  targetChannel: string;
  correlation: number;
  coherence: number;
}
export interface CorrelationData {
  targetChannel: string;
  correlations: ChannelCorrelation[];
}

export interface RecordingFrame {
  relativeTime: number;
  eeg: EEGData;
  bands: BandPower;
  brainState: BrainState;
  correlation: CorrelationData;
}

export interface Recording {
  id: string;
  name: string;
  channel: string;
  startTime: number;
  endTime: number;
  duration: number;
  frames: RecordingFrame[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  currentFrame: RecordingFrame | null;
}

/** 主面板视图：波形分析 / 信号质量诊断 */
export type ViewMode = 'waveform' | 'quality';

/** 最近一次刷新的结果状态 */
export type RefreshStatus =
  | 'idle'      // 尚未刷新
  | 'loading'   // 刷新中
  | 'success'   // 后端数据刷新成功
  | 'degraded'  // 后端不可用，使用本地模拟数据兜底
  | 'empty'     // 接口成功但该通道采样为空
  | 'error';    // 刷新失败且无任何可用数据

/** 数据来源，记录最近一次刷新结果 */
export interface RefreshInfo {
  status: RefreshStatus;
  /** 数据来源：后端 / 本地模拟 / 回放帧 / 空 */
  source: 'server' | 'mock' | 'playback' | 'none';
  sourceLabel: string;
  message: string;
  /** 最近一次成功拿到数据的时间戳（含模拟兜底成功） */
  lastSuccessAt: number | null;
  /** 最近一次失败的时间戳 */
  lastErrorAt: number | null;
  /** 连续失败次数 */
  errorCount: number;
  /** 本次刷新针对的通道，用于识别过期响应 */
  channel: string;
}
