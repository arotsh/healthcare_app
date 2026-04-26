import { useCallback, useState } from 'react';

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const request = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          const err = new Error('Geolocation not supported in this browser');
          setError(err.message);
          setStatus('error');
          reject(err);
          return;
        }
        setStatus('pending');
        setError(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocation(next);
            setStatus('granted');
            resolve(next);
          },
          (err) => {
            setError(err.message ?? 'Location permission denied');
            setStatus('denied');
            reject(err);
          },
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
        );
      }),
    []
  );

  return { location, status, error, request };
}
