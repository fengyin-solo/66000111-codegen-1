import { useEffect } from 'react';
import { useEEGStore } from '../store/eeg';

const REFRESH_INTERVAL_MS = 3000;

/**
 * 波形与信号质量诊断共享的数据刷新驱动。
 * - 挂载在 App 根部，切换视图不会中断轮询；
 * - 切换通道立即刷新一次，两侧面板看到的是同一份结果；
 * - 回放历史录制时暂停实时刷新，由回放帧驱动数据更新。
 */
export const EegRefreshDriver: React.FC = () => {
  const selectedChannel = useEEGStore(s => s.selectedChannel);
  const playbackMode = useEEGStore(s => s.playbackMode);

  useEffect(() => {
    if (playbackMode) return;
    useEEGStore.getState().refreshEEG();
    const timer = window.setInterval(() => {
      useEEGStore.getState().refreshEEG();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [selectedChannel, playbackMode]);

  return null;
};
