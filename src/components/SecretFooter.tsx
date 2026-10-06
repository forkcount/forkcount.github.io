import React, { useState, useRef } from 'react';
import { getBrowserDevSignature, DEV_DEVICE_KEY } from '../services/api.js';

interface SecretFooterProps {
  className?: string;
}

export const SecretFooter: React.FC<SecretFooterProps> = ({ className = 'pt-2 text-center text-[11px] font-mono text-zinc-400' }) => {
  const [tapIndex, setTapIndex] = useState<number>(0);
  const isUnlockingRef = useRef<boolean>(false);

  const handleCharTap = async (index: number) => {
    if (isUnlockingRef.current) return;

    if (index === tapIndex) {
      const nextIndex = tapIndex + 1;
      if (nextIndex === 18) {
        // Successfully tapped all 18 characters in sequence!
        isUnlockingRef.current = true;
        setTapIndex(0);
        await performDevUnlock();
      } else {
        setTapIndex(nextIndex);
      }
    } else if (index === 0) {
      // User restarted sequence from ©
      setTapIndex(1);
    } else {
      // Wrong character tapped - reset silently
      setTapIndex(0);
    }
  };

  const performDevUnlock = async () => {
    try {
      const browserSig = getBrowserDevSignature();
      const rand =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const devToken = `dev_${rand}`;
      const devRecord = {
        username: 'housefly',
        deviceToken: devToken,
        browserSig,
        lockedAt: Date.now()
      };

      // 1. Save dev device to localStorage so this browser never asks again
      localStorage.setItem(DEV_DEVICE_KEY, JSON.stringify(devRecord));
      localStorage.setItem('forkcount_dev_device', JSON.stringify(devRecord));
      localStorage.setItem('forkcount_session_token', 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18');
      localStorage.setItem('forkcount_user_email', 'housefly');
      localStorage.setItem('forkcount_signup_complete', 'true');
      localStorage.setItem('forkcount_signup_complete_usr_545648c7-5e38-44fc-adc5-373e0b3e5e18', 'true');
      localStorage.removeItem('forkcount_guest_id');
      localStorage.removeItem('caloriq_guest_id');
      sessionStorage.removeItem('forkcount_is_first_session');
      sessionStorage.removeItem('caloriq_is_first_session');

      // 2. Reload to /dashboard signed in as @housefly
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Dev unlock failed:', err);
      window.location.href = '/dashboard';
    }
  };

  const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    font: 'inherit',
    color: 'inherit',
    display: 'inline',
    cursor: 'default',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none'
  };

  return (
    <div className={`${className} select-none`}>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(0)} style={btnStyle} aria-hidden="true">
        &copy;
      </button>
      {' '}
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(1)} style={btnStyle} aria-hidden="true">
        2
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(2)} style={btnStyle} aria-hidden="true">
        0
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(3)} style={btnStyle} aria-hidden="true">
        2
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(4)} style={btnStyle} aria-hidden="true">
        6
      </button>
      {' '}
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(5)} style={btnStyle} aria-hidden="true">
        F
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(6)} style={btnStyle} aria-hidden="true">
        o
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(7)} style={btnStyle} aria-hidden="true">
        r
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(8)} style={btnStyle} aria-hidden="true">
        k
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(9)} style={btnStyle} aria-hidden="true">
        C
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(10)} style={btnStyle} aria-hidden="true">
        o
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(11)} style={btnStyle} aria-hidden="true">
        u
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(12)} style={btnStyle} aria-hidden="true">
        n
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(13)} style={btnStyle} aria-hidden="true">
        t
      </button>
      {' '}
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(14)} style={btnStyle} aria-hidden="true">
        v
      </button>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(15)} style={btnStyle} aria-hidden="true">
        1
      </button>
      <span>.</span>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(16)} style={btnStyle} aria-hidden="true">
        0
      </button>
      <span>.</span>
      <button type="button" tabIndex={-1} onClick={() => handleCharTap(17)} style={btnStyle} aria-hidden="true">
        0
      </button>
    </div>
  );
};
