type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

import { IonButton } from '@ionic/react';

const EmptyState: React.FC<EmptyStateProps> = ({ eyebrow, title, message, actionLabel, onAction }) => {
  return (
    <div className="empty-state">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <IonButton fill="outline" size="small" onClick={onAction} style={{ marginTop: '12px' }}>
          {actionLabel}
        </IonButton>
      ) : null}
    </div>
  );
};

export default EmptyState;
