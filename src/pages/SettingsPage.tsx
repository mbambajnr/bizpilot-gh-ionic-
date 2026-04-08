import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

import SectionCard from '../components/SectionCard';
import { roadmapSteps } from '../data/seedBusiness';

const SettingsPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard
            title="Project setup"
            subtitle="This view now reflects the working local MVP foundation."
          >
            <div className="list-block">
              {roadmapSteps.map((step) => (
                <div className="roadmap-row" key={step.id}>
                  <span className={`status-dot ${step.done ? 'done' : 'pending'}`} />
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
