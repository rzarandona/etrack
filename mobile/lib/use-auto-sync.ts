import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { refreshDirectory } from './directory';
import { flush, pendingCount } from './queue';

// NetInfo is a native module. If the running dev client / build hasn't been
// rebuilt since installing it, the module isn't linked and any access throws
// "NativeModule.RNCNetinfo is null". Try to load it lazily and fall back to
// a no-op so the app keeps working — manual sync still flushes pending scans.
type NetInfoModule = {
  fetch: () => Promise<{ isConnected: boolean | null; isInternetReachable: boolean | null }>;
  addEventListener: (
    cb: (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void
  ) => () => void;
};

function loadNetInfo(): NetInfoModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/netinfo');
    const candidate = (mod?.default ?? mod) as NetInfoModule | undefined;
    if (!candidate?.fetch || !candidate?.addEventListener) return null;
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Drains the pending-scan queue automatically:
 *  - on mount, if we're already online and have a queue
 *  - whenever connectivity changes from offline to online
 *
 * Single-flight: never runs two flushes in parallel. If the NetInfo native
 * module isn't available (e.g. JS-reloaded onto an older dev client), this
 * hook becomes a no-op and the user can still sync manually.
 */
export function useAutoSync() {
  const { session, profile } = useAuth();
  const wasOnline = useRef<boolean | null>(null);
  const flushing = useRef(false);

  useEffect(() => {
    if (!session || !profile) return;
    const actorId = profile.id;

    const NetInfo = loadNetInfo();
    if (!NetInfo) return; // older dev client without the native module — skip

    const onOnline = async () => {
      // Refresh the offline directory cache. For supervisors this scopes to
      // employees on assigned events; admins get the full roster; employees
      // and pending users skip (no directory needed).
      if (profile) {
        refreshDirectory(profile.role, profile.id).catch(() => {});
      }

      if (flushing.current) return;
      const n = await pendingCount();
      if (n === 0) return;
      flushing.current = true;
      try {
        await flush(actorId);
      } catch {
        // swallow — flush() already re-queues failures with the error message
      } finally {
        flushing.current = false;
      }
    };

    let unsub: (() => void) | undefined;

    NetInfo.fetch()
      .then((state) => {
        const online = state.isConnected === true && state.isInternetReachable !== false;
        wasOnline.current = online;
        if (online) onOnline();
      })
      .catch(() => {});

    try {
      unsub = NetInfo.addEventListener((state) => {
        const online = state.isConnected === true && state.isInternetReachable !== false;
        // Only trigger on the offline → online transition.
        if (online && wasOnline.current === false) onOnline();
        wasOnline.current = online;
      });
    } catch {
      // module surfaced but listener failed — degrade to no-op
    }

    return () => unsub?.();
  }, [session?.user.id, profile?.id, profile?.role]);
}
