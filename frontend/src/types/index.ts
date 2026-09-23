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

export type RefreshStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty';
export type RefreshSource = 'api' | 'mock' | 'playback';

export interface RefreshInfo {
  status: RefreshStatus;
  source: RefreshSource | null;
  channel: string | null;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
}

/** 一段连续的平直（无变化）采样区间，用于采样完整性诊断 */
export interface FlatRun {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  length: number;
}

/** 异常波动段（幅度显著偏离基线） */
export interface AnomalySegment {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  peakAmplitude: number;
  maxZScore: number;
  kind: 'spike' | 'anomaly';
}

export interface SignalQualityReport {
  channel: string;
  sampleRate: number;
  sampleCount: number;
  durationSec: number;
  expectedSamples: number;
  completenessRatio: number;
  missingSamples: number;
  validSampleCount: number;
  invalidSampleCount: number;
  invalidRatio: number;
  flatRuns: FlatRun[];
  longestFlatRun: number;
  mean: number;
  std: number;
  peakToPeak: number;
  anomalyCount: number;
  anomalySegments: AnomalySegment[];
  anomalyRatio: number;
  score: number;
  grade: 'good' | 'fair' | 'poor';
  gradeLabel: string;
  notes: string[];
  computedAt: number;
}
