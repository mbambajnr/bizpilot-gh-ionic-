import { IonButton, IonIcon } from '@ionic/react';
import { chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { useState } from 'react';

type SectionCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
};

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section className={`section-card${collapsible ? ' section-card-collapsible' : ''}${collapsible && !isExpanded ? ' is-collapsed' : ''}`}>
      <div className="section-head">
        <div className="section-head-copy">
          <h2>{title}</h2>
          <p>{subtitle}</p>
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
