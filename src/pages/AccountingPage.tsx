import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonText,
} from '@ionic/react';
import SectionCard from '../components/SectionCard';

const AccountingPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Accounting</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard
            title="Financial Overview"
            subtitle="Secure accounting module for authorized users only."
          >
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <IonText color="medium">
                    <p>Accounting transactions, expense logs, and financial reports are securely isolated in this module.</p>
                </IonText>
            </div>
          </SectionCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AccountingPage;
