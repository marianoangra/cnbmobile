import { useEffect, useRef } from 'react';
import { iniciarTrace, pararTrace } from '../services/performance';

// Mede o tempo total que o usuário permanece em uma tela.
// Inicia um trace no mount e finaliza no unmount.
export function useScreenTrace(nome) {
  const traceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await iniciarTrace(nome);
      if (cancelled) {
        if (t) await pararTrace(t);
      } else {
        traceRef.current = t;
      }
    })();
    return () => {
      cancelled = true;
      const t = traceRef.current;
      traceRef.current = null;
      if (t) pararTrace(t);
    };
  }, [nome]);
}
