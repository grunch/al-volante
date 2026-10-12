import { useEffect, useRef, useState } from 'react';
import { AUDIO_STORAGE_KEY, AudioSession, parseAudioSettings } from './session.ts';
import type { AudioSettings, AudioStatus } from './session.ts';

export function useDrivingAudio() {
  const [settings, setSettings] = useState(() => {
    try {
      return parseAudioSettings(localStorage.getItem(AUDIO_STORAGE_KEY));
    } catch {
      return parseAudioSettings(null);
    }
  });
  const [status, setStatus] = useState<AudioStatus>('waiting');
  const [storageError, setStorageError] = useState(false);
  const session = useRef<AudioSession | null>(null);
  useEffect(() => {
    const audio = new AudioSession(setStatus);
    session.current = audio;
    const suspend = () => audio.suspend();
    window.addEventListener('blur', suspend);
    document.addEventListener('visibilitychange', suspend);
    return () => {
      window.removeEventListener('blur', suspend);
      document.removeEventListener('visibilitychange', suspend);
      audio.dispose();
      session.current = null;
    };
  }, []);
  useEffect(() => {
    session.current?.configure(settings);
  }, [settings]);
  const change = (next: AudioSettings) => {
    setSettings(next);
    session.current?.configure(next);
    void session.current?.unlock();
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  return { session, settings, status, storageError, change };
}
