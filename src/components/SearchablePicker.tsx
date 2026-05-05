import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  IonButtons,
} from '@ionic/react';
import { closeOutline, searchOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';

export type PickerItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  image?: string;
  [key: string]: unknown;
};

interface SearchablePickerProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSelect: (item: PickerItem) => void;
  items: PickerItem[];
  title: string;
  placeholder?: string;
  emptyActionLabel?: string;
  onEmptyAction?: (query: string) => void;
}

const SearchablePicker: React.FC<SearchablePickerProps> = ({
  isOpen,
  onDismiss,
  onSelect,
  items,
  title,
  placeholder = 'Search...',
  emptyActionLabel,
  onEmptyAction,
}) => {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.subtitle?.toLowerCase().includes(lower) ||
        item.meta?.toLowerCase().includes(lower)
    );
  }, [items, query]);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={query}
            onIonInput={(e) => setQuery(e.detail.value ?? '')}
            placeholder={placeholder}
          />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {filteredItems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <IonIcon icon={searchOutline} style={{ fontSize: '48px', color: 'var(--ion-color-medium)' }} />
            <p style={{ color: 'var(--ion-color-medium)' }}>No matching records found.</p>
            {emptyActionLabel && onEmptyAction ? (
              <IonButton
                fill="outline"
                onClick={() => {
                  onEmptyAction(trimmedQuery);
                  onDismiss();
                }}
              >
                {emptyActionLabel}
              </IonButton>
            ) : null}
          </div>
        ) : (
          <IonList>
            {filteredItems.map((item) => (
              <IonItem
                button
                key={item.id}
                onClick={() => {
                  onSelect(item);
                  onDismiss();
                }}
              >
                {item.image && (
                  <img
                    slot="start"
                    src={item.image}
                    alt={item.title}
                    style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                )}
                <IonLabel>
                  <h2>{item.title}</h2>
                  <p>{item.subtitle}</p>
                </IonLabel>
                {item.meta && (
                  <IonLabel slot="end" style={{ textAlign: 'right' }}>
                    <p>{item.meta}</p>
                  </IonLabel>
                )}
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonModal>
  );
};

export default SearchablePicker;
