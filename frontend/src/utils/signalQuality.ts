import { EEGData, SignalQualityReport, FlatRun, AnomalySegment } from '../types';
import { ALL_CHANNELS, DEFAULT_SAMPLE_RATE } from '../constants/channels';

/** 平直采样段判定的最短长度（约 50ms，@256Hz） */
const MIN_FLAT_RUN = 13;
/** z-score 异常 / 尖峰阈值 */
const Z_ANOMALY = 3;
const Z_SPIKE = 5;
/** 相邻异常点之间允许的最大间隔（样本数），小于该值则合并为同一段 */
const ANOMALY_MERGE_GAP = 8;

const timeAt = (eeg: EEGData, index: number, sampleRate: number): number => {
  const t = eeg.time?.[index];
  return typeof t === 'number' && isFinite(t) ? t : index / sampleRate;
};

/**
 * 对单个通道的最近一段采样做质量诊断。
 * 兼容历史录制数据：通道缺失、采样为空或长度不足时返回 null（由调用方展示空状态）。
 */
export const analyzeSignalQuality = (channel: string, eeg: EEGData | null): SignalQualityReport | null => {
  if (!eeg || !channel) return null;
  const raw = eeg.data?.[channel];
  if (!raw || raw.length === 0) return null;

  const sampleRate = eeg.sample_rate > 0 ? eeg.sample_rate : DEFAULT_SAMPLE_RATE;
  const durationSec = eeg.duration > 0
    ? eeg.duration
    : eeg.time && eeg.time.length >= 2
      ? (eeg.time[eeg.time.length - 1] - eeg.time[0])
      : raw.length / sampleRate;

  const sampleCount = raw.length;
  const expectedSamples = Math.max(1, Math.round(sampleRate * durationSec));

  // 采样完整性：有效/无效值统计
  let invalidCount = 0;
  let validCount = 0;
  const cleaned: number[] = new Array(sampleCount);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < sampleCount; i++) {
    const v = raw[i];
    if (typeof v !== 'number' || !isFinite(v)) {
      invalidCount++;
      cleaned[i] = 0;
    } else {
      validCount++;
      cleaned[i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const missingSamples = Math.max(0, expectedSamples - sampleCount);
  const completenessRatio = Math.min(1, sampleCount / expectedSamples);
  const invalidRatio = invalidCount / sampleCount;

  // 平直（恒定）采样段：相邻值完全相同的连续区间
  const flatRuns: FlatRun[] = [];
  let runStart = 0;
  for (let i = 1; i <= sampleCount; i++) {
    const same = i < sampleCount &&
      typeof cleaned[i] === 'number' &&
      typeof cleaned[i - 1] === 'number' &&
      cleaned[i] === cleaned[i - 1];
    if (!same) {
      const length = i - runStart;
      if (length >= MIN_FLAT_RUN) {
        flatRuns.push({
          startIndex: runStart,
          endIndex: i - 1,
          startTime: timeAt(eeg, runStart, sampleRate),
          endTime: timeAt(eeg, i - 1, sampleRate),
          length,
        });
      }
      runStart = i;
    }
  }
  const longestFlatRun = flatRuns.reduce((m, r) => Math.max(m, r.length), 0);

  // 基线统计（基于有效样本）
  let sum = 0;
  for (const v of cleaned) sum += v;
  const mean = sum / sampleCount;
  let variance = 0;
  for (const v of cleaned) variance += (v - mean) * (v - mean);
  const std = Math.sqrt(variance / sampleCount);
  const peakToPeak = validCount >= 2 ? max - min : 0;

  // 异常波动段：|z| > 3 的连续样本合并成段
  const anomalySegments: AnomalySegment[] = [];
  if (std > 1e-9) {
    let segStart = -1;
    let segEnd = -1;
    let segPeak = 0;
    let segMaxZ = 0;
    const flush = () => {
      if (segStart < 0) return;
      anomalySegments.push({
        startIndex: segStart,
        endIndex: segEnd,
        startTime: timeAt(eeg, segStart, sampleRate),
        endTime: timeAt(eeg, segEnd, sampleRate),
        durationMs: Math.round((timeAt(eeg, segEnd, sampleRate) - timeAt(eeg, segStart, sampleRate)) * 1000),
        peakAmplitude: segPeak,
        maxZScore: segMaxZ,
        kind: segMaxZ >= Z_SPIKE ? 'spike' : 'anomaly',
      });
    };
    for (let i = 0; i < sampleCount; i++) {
      const z = Math.abs((cleaned[i] - mean) / std);
      if (z > Z_ANOMALY) {
        if (segStart < 0 || i - segEnd > ANOMALY_MERGE_GAP) {
          flush();
          segStart = i;
          segPeak = cleaned[i];
          segMaxZ = z;
        }
        segEnd = i;
        if (z > segMaxZ) segMaxZ = z;
        if (Math.abs(cleaned[i]) > Math.abs(segPeak)) segPeak = cleaned[i];
      }
    }
    flush();
  }

  const anomalyCount = anomalySegments.reduce((n, s) => n + (s.endIndex - s.startIndex + 1), 0);
  const anomalyRatio = anomalyCount / sampleCount;
  const flatRatio = longestFlatRun / sampleCount;

  // 综合评分与分级
  let score = 100;
  score -= (1 - completenessRatio) * 40;
  score -= invalidRatio * 200;
  score -= flatRatio * 60;
  score -= anomalyRatio * 150;
  score = Math.round(Math.max(0, Math.min(100, score)));
  const grade: SignalQualityReport['grade'] = score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor';
  const gradeLabel = grade === 'good' ? '良好' : grade === 'fair' ? '一般' : '较差';

  const notes: string[] = [];
  if (completenessRatio < 0.999) {
    notes.push(`采样不完整：实际 ${sampleCount} 点 / 预期 ${expectedSamples} 点，缺失 ${missingSamples} 点`);
  }
  if (invalidCount > 0) {
    notes.push(`存在 ${invalidCount} 个非数值采样（NaN/Infinity），占 ${(invalidRatio * 100).toFixed(1)}%`);
  }
  if (flatRuns.length > 0) {
    notes.push(`检测到 ${flatRuns.length} 段平直采样，最长 ${longestFlatRun} 点（${(longestFlatRun / sampleRate).toFixed(2)}s），疑似信号停滞`);
  }
  if (anomalySegments.length > 0) {
    const spikes = anomalySegments.filter(s => s.kind === 'spike').length;
    notes.push(`检测到 ${anomalySegments.length} 段异常波动${spikes > 0 ? `（含 ${spikes} 段尖峰）` : ''}，占 ${(anomalyRatio * 100).toFixed(1)}%`);
  }
  if (notes.length === 0) {
    notes.push('采样完整，未发现明显异常波动，信号质量良好');
  }

  return {
    channel,
    sampleRate,
    sampleCount,
    durationSec,
    expectedSamples,
    completenessRatio,
    missingSamples,
    validSampleCount: validCount,
    invalidSampleCount: invalidCount,
    invalidRatio,
    flatRuns,
    longestFlatRun,
    mean,
    std,
    peakToPeak,
    anomalyCount: anomalySegments.length,
    anomalySegments,
    anomalyRatio,
    score,
    grade,
    gradeLabel,
    notes,
    computedAt: Date.now(),
  };
};

/* ------------------------- 离线模拟数据（接口不可用时） ------------------------- */

export const generateMockEEG = (durationSec: number = 3.0): EEGData => {
  const sampleRate = DEFAULT_SAMPLE_RATE;
  const length = Math.floor(sampleRate * durationSec);
  const time: number[] = [];
  const data: Record<string, number[]> = {};
  for (let i = 0; i < length; i++) {
    time.push(i / sampleRate);
  }
  for (const ch of ALL_CHANNELS) {
    const sig: number[] = [];
    const alphaFreq = 8 + Math.random() * 4;
    const betaFreq = 15 + Math.random() * 10;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const value = 0.5 * Math.sin(2 * Math.PI * alphaFreq * t) +
                    0.3 * Math.sin(2 * Math.PI * betaFreq * t) +
                    0.2 * (Math.random() * 2 - 1);
      sig.push(value);
    }
    data[ch] = sig;
  }
  return { channels: [...ALL_CHANNELS], sample_rate: sampleRate, data, time, duration: durationSec };
};
