import { EEGData } from '../types';

/**
 * 信号质量诊断算法
 *
 * 全部基于当前（或历史回放帧中的）EEGData 在前端计算，
 * 因此对老版本录制下来、不含质量字段的历史数据同样兼容。
 */

export type AnomalyType = 'spike' | 'flat';

export interface AnomalySegment {
  /** 起始采样序号 */
  startSample: number;
  /** 结束采样序号（含） */
  endSample: number;
  /** 起始时刻（秒） */
  startTime: number;
  /** 结束时刻（秒） */
  endTime: number;
  /** 持续时长（秒） */
  duration: number;
  /** 段内峰值绝对值（µV 量级） */
  peakAmplitude: number;
  type: AnomalyType;
  /** 异常类型标签 */
  typeLabel: string;
}

export interface QualityReport {
  channel: string;
  /** 期望采样点数（采样率 × 时长） */
  expectedSamples: number;
  /** 实际收到的采样点数 */
  receivedSamples: number;
  /** NaN / Infinity 等无效点数量 */
  invalidSamples: number;
  /** 有效点数 = 实际 - 无效 */
  validSamples: number;
  /** 缺失点数 = 期望 - 实际（不为负） */
  missingSamples: number;
  /** 采样完整率 0~1，= 有效点 / 期望点 */
  completeness: number;
  /** 完整率评级 */
  grade: 'good' | 'fair' | 'poor' | 'empty';
  gradeLabel: string;
  mean: number;
  std: number;
  maxAmplitude: number;
  anomalyCount: number;
  anomalySegments: AnomalySegment[];
  sampleRate: number;
  duration: number;
}

/** 异常波动判定阈值：偏离均值超过该倍数标准差视为尖峰 */
const SPIKE_Z_THRESHOLD = 3.5;
/** 相邻异常点间隔小于该采样数时合并为同一段 */
const MERGE_GAP_SAMPLES = 10;
/** 连续平台（相邻点绝对差 <= 该值）达到该长度视为饱和/脱落平段 */
const FLAT_MIN_SAMPLES = 40;
const FLAT_EPS = 1e-6;
/** 面板最多展示的异常段数量 */
export const MAX_ANOMALY_DISPLAY = 10;

const isValid = (v: number) => typeof v === 'number' && Number.isFinite(v);

/**
 * 计算单个通道的信号质量。
 * 通道不存在或整段为空时返回 null，由上层展示“采样为空”状态。
 */
export const computeSignalQuality = (eegData: EEGData | null, channel: string): QualityReport | null => {
  if (!eegData) return null;
  const raw = eegData.data?.[channel];
  if (!raw || raw.length === 0) return null;

  const sampleRate = eegData.sample_rate > 0 ? eegData.sample_rate : 0;
  const duration = eegData.duration > 0 ? eegData.duration : 0;
  // 兼容历史录制帧：缺失 duration 时无法计算缺失点数，
  // 以实际长度作为期望值（即只统计无效点，不误报缺失）
  const expectedSamples = sampleRate > 0 && duration > 0
    ? Math.round(sampleRate * duration)
    : raw.length;

  const receivedSamples = raw.length;
  let invalidSamples = 0;
  const valid: number[] = [];
  for (const v of raw) {
    if (isValid(v)) valid.push(v);
    else invalidSamples += 1;
  }
  const validSamples = valid.length;
  const missingSamples = Math.max(0, expectedSamples - receivedSamples);
  const completeness = expectedSamples > 0
    ? Math.max(0, Math.min(1, validSamples / expectedSamples))
    : (validSamples > 0 ? 1 : 0);

  let mean = 0;
  let std = 0;
  let maxAmplitude = 0;
  if (validSamples > 0) {
    let sum = 0;
    for (const v of valid) sum += v;
    mean = sum / validSamples;
    let varSum = 0;
    for (const v of valid) {
      const d = v - mean;
      varSum += d * d;
      const abs = Math.abs(v);
      if (abs > maxAmplitude) maxAmplitude = abs;
    }
    std = Math.sqrt(varSum / validSamples);
  }

  const flags: { idx: number; type: AnomalyType }[] = [];

  // 1) 尖峰/骤变：偏离均值超过 3.5 个标准差
  if (std > 1e-9) {
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (isValid(v) && Math.abs(v - mean) > SPIKE_Z_THRESHOLD * std) {
        flags.push({ idx: i, type: 'spike' });
      }
    }
  }

  // 2) 平段：电极脱落/削顶饱和时信号长时间无变化（标记区间内所有点）
  let runStart = 0;
  for (let i = 1; i <= raw.length; i++) {
    const same = i < raw.length
      && isValid(raw[i]) && isValid(raw[i - 1])
      && Math.abs(raw[i] - raw[i - 1]) <= FLAT_EPS;
    if (!same) {
      if (i - runStart >= FLAT_MIN_SAMPLES) {
        for (let j = runStart; j < i; j++) flags.push({ idx: j, type: 'flat' });
      }
      runStart = i;
    }
  }

  // 按位置排序后合并相近的点为异常段
  flags.sort((a, b) => a.idx - b.idx);
  const segments: Array<{ start: number; end: number; type: AnomalyType }> = [];
  for (const f of flags) {
    const last = segments[segments.length - 1];
    if (last && f.idx - last.end <= MERGE_GAP_SAMPLES) {
      last.end = f.idx;
      // 平段的优先级更高，用于标注整段类型
      if (f.type === 'flat') last.type = 'flat';
    } else {
      segments.push({ start: f.idx, end: f.idx, type: f.type });
    }
  }

  const tAt = (idx: number) => {
    const fromTime = eegData.time?.[idx];
    if (typeof fromTime === 'number' && Number.isFinite(fromTime)) return fromTime;
    return sampleRate > 0 ? idx / sampleRate : 0;
  };

  const anomalySegments: AnomalySegment[] = segments.map(seg => {
    let peak = 0;
    for (let i = seg.start; i <= seg.end && i < raw.length; i++) {
      const v = raw[i];
      if (isValid(v) && Math.abs(v) > peak) peak = Math.abs(v);
    }
    const startTime = tAt(seg.start);
    const endTime = tAt(seg.end);
    const isFlat = seg.type === 'flat';
    return {
      startSample: seg.start,
      endSample: seg.end,
      startTime,
      endTime,
      duration: Math.max(0, endTime - startTime) + (sampleRate > 0 ? 1 / sampleRate : 0),
      peakAmplitude: peak,
      type: seg.type,
      typeLabel: isFlat ? '平台/削顶' : '尖峰骤变',
    };
  });

  let grade: QualityReport['grade'];
  let gradeLabel: string;
  if (validSamples === 0) {
    grade = 'empty';
    gradeLabel = '采样为空';
  } else if (completeness >= 0.98 && invalidSamples === 0) {
    grade = 'good';
    gradeLabel = '良好';
  } else if (completeness >= 0.9) {
    grade = 'fair';
    gradeLabel = '部分缺失';
  } else {
    grade = 'poor';
    gradeLabel = '严重不完整';
  }

  return {
    channel,
    expectedSamples,
    receivedSamples,
    invalidSamples,
    validSamples,
    missingSamples,
    completeness,
    grade,
    gradeLabel,
    mean,
    std,
    maxAmplitude,
    anomalyCount: anomalySegments.length,
    anomalySegments,
    sampleRate,
    duration,
  };
};

/** 判断异常序号集合（供迷你波形高亮使用，做了抽稀） */
export const buildAnomalySampleSet = (report: QualityReport | null, maxPoints = 400): Set<number> => {
  const set = new Set<number>();
  if (!report) return set;
  const span = Math.max(1, report.receivedSamples);
  const step = Math.max(1, Math.floor(span / maxPoints));
  for (const seg of report.anomalySegments) {
    for (let i = seg.startSample; i <= seg.endSample; i += step) set.add(i);
  }
  return set;
};
