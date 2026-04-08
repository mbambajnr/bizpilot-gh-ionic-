import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

import SectionCard from '../components/SectionCard';
import { useBusiness } from '../context/BusinessContext';
import { formatCurrency } from '../utils/format';

const CustomersPage: React.FC = () => {
  const { state } = useBusiness();

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Customers</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard
            title="Customer balances"
            subtitle="Outstanding balances update automatically when a sale is only partially paid."
          >
            <div className="list-block">
              {state.customers.map((customer) => (
                <div className="list-row" key={customer.id}>
                  <div>
                    <strong>{customer.name}</strong>
                    <p className="code-label">{customer.clientId}</p>
                    <p>Last payment {customer.lastPayment}</p>
                  </div>
                  <div className="right-meta">
                    <strong className={customer.balance === 0 ? 'success-text' : 'danger-text'}>
                      {customer.balance === 0 ? 'Paid' : `${formatCurrency(customer.balance)} due`}
                    </strong>
                    <p>{customer.channel}</p>
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

export default CustomersPage;
