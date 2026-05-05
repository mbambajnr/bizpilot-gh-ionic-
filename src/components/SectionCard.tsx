import { IonButton, IonIcon } from '@ionic/react';
import { chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { useState } from 'react';

type SectionCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  highlighted?: boolean;
  highlightLabel?: string;
  dataTestId?: string;
};

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultExpanded = true,
  className = '',
  highlighted = false,
  highlightLabel,
  dataTestId,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section
      className={`section-card${collapsible ? ' section-card-collapsible' : ''}${collapsible && !isExpanded ? ' is-collapsed' : ''}${highlighted ? ' section-card-highlighted' : ''}${className ? ` ${className}` : ''}`}
      data-testid={dataTestId}
    >
      <div className="section-head">
        <div className="section-head-copy">
          <h2>{title}</h2>
          <p>{subtitle}</p>
          {highlightLabel ? (
            <div className="section-arrival" aria-live="polite">
              <span className="section-arrival-badge">Arrival</span>
              <span className="section-arrival-text">{highlightLabel}</span>
            </div>
          ) : null}
        </div>
        {collapsible ? (
          <IonButton
            fill="clear"
            size="small"
            className="section-collapse-button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
          >
            <IonIcon slot="start" icon={isExpanded ? chevronUpOutline : chevronDownOutline} />
            {isExpanded ? 'Collapse' : 'Expand'}
          </IonButton>
        ) : null}
      </div>
      {!collapsible || isExpanded ? children : null}
    </section>
  );
};

export default SectionCard;
