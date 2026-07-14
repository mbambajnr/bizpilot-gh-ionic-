import { IonBadge, IonButton, IonIcon } from '@ionic/react';
import { cloudDoneOutline, cloudOfflineOutline, cloudUploadOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';

import { isOnline, onNetworkChange } from '../offline/networkStatus';
import { flushOfflineSync, getPendingOfflineSync, subscribeOfflineSync } from '../offline/offlineSync';

/**
 * Small connectivity + pending-sync indicator.
 *
 * - Offline: shows an "Offline" badge with the number of captured changes.
 * - Online with a backlog: shows a "Sync now" affordance (auto-flush also
 *   runs on reconnect and on a heartbeat — this is just for reassurance).
 * - Online and clean: renders nothing.
 */
export default function OfflineSyncStatus() {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(getPendingOfflineSync().length);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    const unsubscribeNetwork = onNetworkChange(setOnline);
    const unsubscribeQueue = subscribeOfflineSync((pending) => setPendingCount(pending.length));
    return () => {
      unsubscribeNetwork();
      unsubscribeQueue();
    };
  }, []);

  if (online && pendingCount === 0) {
    return null;
  }

  if (!online) {
    return (
      <IonBadge color="medium" data-testid="offline-sync-status">
        <IonIcon icon={cloudOfflineOutline} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        Offline{pendingCount > 0 ? ` — ${pendingCount} saved` : ''}
      </IonBadge>
    );
  }

  return (
    <IonButton
      size="small"
      fill="outline"
      color="warning"
      disabled={flushing}
      data-testid="offline-sync-status"
      onClick={async () => {
        setFlushing(true);
        try {
          await flushOfflineSync();
        } finally {
          setFlushing(false);
        }
      }}
    >
      <IonIcon icon={flushing ? cloudDoneOutline : cloudUploadOutline} slot="start" />
      {flushing ? 'Syncing…' : `Sync ${pendingCount} pending`}
    </IonButton>
  );
}
