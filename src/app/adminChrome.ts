import { useEffect, useState } from 'react';

type Listener = (code: string | null) => void;

let reservationCode: string | null = null;
const listeners = new Set<Listener>();

export function setReservationChromeCode(code: string | null) {
  if (reservationCode === code) return;
  reservationCode = code;
  listeners.forEach((listener) => listener(code));
}

export function useReservationChromeCode() {
  const [code, setCode] = useState(reservationCode);

  useEffect(() => {
    listeners.add(setCode);
    setCode(reservationCode);
    return () => {
      listeners.delete(setCode);
    };
  }, []);

  return code;
}
