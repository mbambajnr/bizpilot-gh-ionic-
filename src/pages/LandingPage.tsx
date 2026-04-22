import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
} from '@ionic/react';
import {
  arrowForwardOutline,
  calendarOutline,
  checkmarkCircleOutline,
  cubeOutline,
  documentTextOutline,
  eyeOutline,
  layersOutline,
  peopleOutline,
  walletOutline,
} from 'ionicons/icons';
import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    document.body.setAttribute('data-theme', 'light');
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen={true}>
        <main className="landing-shell">
          <section className="landing-hero">
            <div className="landing-nav">
              <div className="landing-brand">
                <img src="/assets/logo.png" alt="BisaPilot" className="landing-logo" />
                <div>
                  <strong>BisaPilot</strong>
                  <p>Your scaling partner</p>
                </div>
              </div>
              <div className="landing-nav-actions">
                <IonButton fill="clear" color="dark" onClick={() => history.push('/auth')}>
                  Sign in
                </IonButton>
                <IonButton fill="solid" onClick={() => history.push('/auth')}>
                  Start with BisaPilot
                </IonButton>
              </div>
            </div>

            <div className="landing-hero-grid">
              <div className="landing-copy">
                <p className="landing-eyebrow">Your scaling partner</p>
                <h1>Everything your business runs on, in one place.</h1>
                <p className="landing-lead">
                  BisaPilot brings together customers, sales, stock, quotations, invoices, team permissions, and branded documents into one clean workspace
                  {' '}— so you can stop juggling tools and start running operations with clarity.
                </p>
                <div className="landing-cta-row">
                  <IonButton size="large" onClick={() => history.push('/auth')}>
                    Start your workspace
                    <IonIcon slot="end" icon={arrowForwardOutline} />
                  </IonButton>
                  <IonButton size="large" fill="outline" color="dark" href="#features">
                    See BisaPilot in action
                  </IonButton>
                </div>
                <div className="landing-hero-trust">
                  <IonIcon icon={checkmarkCircleOutline} />
                  <span>Your scaling partner for structure, visibility, and control.</span>
                </div>
              </div>

              <div className="landing-preview-panel">
                <div className="landing-preview-card">
                  <div className="landing-preview-top">
                    <div>
                      <p className="landing-preview-label">Inside BisaPilot</p>
                      <h3>BisaPilot workspace</h3>
                    </div>
                    <span className="landing-preview-badge">Live operations</span>
                  </div>

                  <div className="landing-preview-metrics">
                    <div className="landing-metric">
                      <span>Sales</span>
                      <strong>GH¢ 12,750</strong>
                    </div>
                    <div className="landing-metric">
                      <span>Receivables</span>
                      <strong>GH¢ 3,420</strong>
                    </div>
                    <div className="landing-metric">
                      <span>Low stock</span>
                      <strong>4 items</strong>
                    </div>
                  </div>

                  <div className="landing-preview-stack">
                    <div className="landing-preview-line">
                      <div>
                        <strong>Connected customer workflow</strong>
                        <p>Move from contact record to quotation, invoice, statement, and follow-up without breaking the trail.</p>
                      </div>
                      <IonIcon icon={documentTextOutline} />
                    </div>
                    <div className="landing-preview-line">
                      <div>
                        <strong>Inventory that stays tied to sales</strong>
                        <p>Track what is moving, what is low, and what needs attention before stock issues become customer issues.</p>
                      </div>
                      <IonIcon icon={cubeOutline} />
                    </div>
                    <div className="landing-preview-line">
                      <div>
                        <strong>Controlled team access</strong>
                        <p>Assign the right visibility to each employee so operational access stays intentional as the team grows.</p>
                      </div>
                      <IonIcon icon={peopleOutline} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-trust-band">
              <p className="landing-trust-band-label">Why BisaPilot feels dependable</p>
              <div className="landing-trust-strip">
                <article className="landing-trust-item">
                  <strong>Connected workflows</strong>
                  <p>Customers, sales, stock, quotations, invoices, and follow-up stay in one operating flow.</p>
                </article>
                <article className="landing-trust-item">
                  <strong>Business-facing output</strong>
                  <p>Branded invoices, quotations, and waybills are part of the product, not an afterthought.</p>
                </article>
                <article className="landing-trust-item">
                  <strong>Real team control</strong>
                  <p>Permissions and employee accounts are structured for actual staff roles, not shared access.</p>
                </article>
                <article className="landing-trust-item">
                  <strong>Ready for daily use</strong>
                  <p>Designed for practical desk work and responsive enough for day-to-day mobile operations.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-head">
              <p className="landing-eyebrow">What BisaPilot is</p>
              <h2>A practical control layer for the operational work that keeps a business moving.</h2>
              <p>
                BisaPilot brings together the core work of running a small or growing business: customers, sales, quotations,
                invoices, stock, expenses, brand identity, and employee permissions.
              </p>
            </div>

            <div className="landing-audience-grid">
              <article className="landing-info-card">
                <h3>Who it is for</h3>
                <p>Retail shops, distributors, service teams, and owner-led businesses that need more control, cleaner records, and less operational guesswork.</p>
              </article>
              <article className="landing-info-card">
                <h3>What it replaces</h3>
                <p>Loose notebooks, scattered spreadsheets, missing invoice trails, unclear stock balances, and informal staff access decisions.</p>
              </article>
              <article className="landing-info-card">
                <h3>Why it matters</h3>
                <p>When sales, stock, documents, and permissions stay connected, the business runs with more clarity, better follow-through, and fewer avoidable mistakes.</p>
              </article>
            </div>
          </section>

          <section className="landing-section landing-problem-solution">
            <div className="landing-problem-card">
              <p className="landing-eyebrow">Common problem</p>
              <h3>Operational work usually gets split across too many places.</h3>
              <ul className="landing-check-list">
                <li>Customer balances live in one place, invoices in another.</li>
                <li>Stock updates happen too late or not at all.</li>
                <li>Team members see too much or too little.</li>
                <li>Branding on documents feels inconsistent.</li>
              </ul>
            </div>
            <div className="landing-solution-card">
              <p className="landing-eyebrow">BisaPilot solution</p>
              <h3>Keep the operational chain connected from start to finish.</h3>
              <ul className="landing-check-list">
                <li>Sales feed invoices, stock movement, and customer balances automatically.</li>
                <li>Quotations convert cleanly into confirmed transactions.</li>
                <li>Branding flows into invoices, quotations, and waybills.</li>
                <li>Permissions shape what each employee can actually access.</li>
              </ul>
            </div>
          </section>

          <section className="landing-section" id="features">
            <div className="landing-section-head">
              <p className="landing-eyebrow">Key features</p>
              <h2>The core workflows a business needs, without extra admin clutter.</h2>
            </div>

            <div className="landing-feature-grid">
              <article className="landing-feature-card">
                <IonIcon icon={peopleOutline} />
                <h3>Customers and follow-up</h3>
                <p>Track contact details, balances, invoice history, and quick outreach from one customer workflow.</p>
              </article>
              <article className="landing-feature-card">
                <IonIcon icon={documentTextOutline} />
                <h3>Sales, quotations, and documents</h3>
                <p>Create quotations, convert them to sales, and generate branded invoices and waybills with clear audit trails.</p>
              </article>
              <article className="landing-feature-card">
                <IonIcon icon={cubeOutline} />
                <h3>Inventory visibility</h3>
                <p>Manage products, stock levels, movements, and bulk onboarding so inventory stays tied to real selling activity.</p>
              </article>
              <article className="landing-feature-card">
                <IonIcon icon={walletOutline} />
                <h3>Expenses and reporting</h3>
                <p>Record business costs, understand receivables, and keep a clearer picture of day-to-day financial position.</p>
              </article>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-intro-band">
              <div>
                <p className="landing-eyebrow">Why the product feels different</p>
                <h2>BisaPilot is designed around operational continuity, not isolated forms.</h2>
              </div>
              <p>
                The product is strongest when the day’s work moves through it naturally: customer record, quotation, sale, invoice, stock movement,
                follow-up, and permissions all staying in sync.
              </p>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-head">
              <p className="landing-eyebrow">Product preview</p>
              <h2>Designed to feel like a working operations desk, not just a collection of screens.</h2>
              <p>These previews use real BisaPilot product captures so the page reflects the actual app instead of speculative mockups.</p>
            </div>

            <div className="landing-product-spotlight">
              <article className="landing-screenshot-card is-large">
                <div className="landing-screenshot-copy">
                  <div className="landing-screenshot-kicker">
                    <IonIcon icon={layersOutline} />
                    <p className="landing-preview-label">Daily control</p>
                  </div>
                  <h3>See the customer relationship as an operating record, not just a contact entry.</h3>
                  <p>
                    BisaPilot keeps account standing, contact context, history access, and follow-up actions close together so the team can act quickly without opening five tools.
                  </p>
                </div>
                <img
                  src="/cypress/screenshots-mobile-after/mobile_qa.cy.ts/mobile-customers-list.png"
                  alt="BisaPilot customer management preview"
                  className="landing-screenshot"
                />
              </article>

              <div className="landing-screenshot-grid">
                <article className="landing-screenshot-card">
                  <div className="landing-screenshot-copy">
                    <p className="landing-preview-label">Sales workflow</p>
                    <h3>Record sales cleanly and keep inventory, customer activity, and documents aligned.</h3>
                    <p>Built for practical selling activity, including walk-in sales, payment tracking, and branded invoice output.</p>
                  </div>
                  <img
                    src="/cypress/screenshots-mobile-after/mobile_qa.cy.ts/mobile-sales-top.png"
                    alt="BisaPilot sales page preview"
                    className="landing-screenshot"
                  />
                </article>

                <article className="landing-screenshot-card">
                  <div className="landing-screenshot-copy">
                    <p className="landing-preview-label">Document output</p>
                    <h3>Generate business-facing documents that stay branded, readable, and operationally useful.</h3>
                    <p>Invoices, quotations, and waybills carry the business identity forward while staying usable on desktop and mobile.</p>
                  </div>
                  <img
                    src="/cypress/screenshots-mobile-docs-after/mobile_qa_docs.cy.ts/mobile-waybill-detail-after.png"
                    alt="BisaPilot waybill preview"
                    className="landing-screenshot"
                  />
                </article>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-head">
              <p className="landing-eyebrow">Early trust signals</p>
              <h2>BisaPilot already shows the shape of a serious working tool.</h2>
              <p>
                The strongest proof right now is product proof: real workflows, real screens, and a system that already connects customers, sales,
                inventory, branded documents, and team permissions in one place.
              </p>
            </div>

            <div className="landing-testimonial-grid">
              <article className="landing-testimonial-card">
                <strong>Operational coverage</strong>
                <p>BisaPilot already spans the workflows many small teams usually piece together manually: customers, sales, quotations, invoices, waybills, stock, expenses, and team access.</p>
                <span>Closer to an operating layer than a single-purpose tracker</span>
              </article>
              <article className="landing-testimonial-card">
                <strong>Business-facing output</strong>
                <p>Brand identity, invoice actions, and PDF workflows are already part of the product experience, which gives BisaPilot stronger credibility in customer-facing operations.</p>
                <span>Useful when the business cares how its documents actually leave the system</span>
              </article>
              <article className="landing-testimonial-card">
                <strong>Team control</strong>
                <p>Permissions, employee account management, and account deactivation already give the product a stronger backbone than a spreadsheet replacement dressed up as software.</p>
                <span>Better suited to businesses with real staff responsibility and access boundaries</span>
              </article>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-head">
              <p className="landing-eyebrow">Getting started</p>
              <h2>Choose the next step that matches where your business is right now.</h2>
            </div>

            <div className="landing-plan-grid">
              <article className="landing-plan-card is-primary">
                <p className="landing-preview-label">Start now</p>
                <h3>Set up the workspace and start running the operational core in one place.</h3>
                <ul className="landing-check-list">
                  <li>Sales, customers, quotations, and invoices</li>
                  <li>Inventory and bulk stock import</li>
                  <li>Brand identity and document output</li>
                  <li>Team accounts and role-based access</li>
                </ul>
                <IonButton expand="block" onClick={() => history.push('/auth')}>
                  Start with BisaPilot
                  <IonIcon slot="end" icon={arrowForwardOutline} />
                </IonButton>
              </article>

              <article className="landing-plan-card">
                <div className="landing-plan-icon">
                  <IonIcon icon={calendarOutline} />
                </div>
                <h3>Need a guided rollout first?</h3>
                <p>
                  Review the product flow first, then roll it into the business in a controlled way as branding, permissions, and document routines are finalized.
                </p>
                <div className="landing-inline-actions">
                  <IonButton fill="outline" color="dark" onClick={() => history.push('/auth')}>
                    <IonIcon slot="start" icon={eyeOutline} />
                    Review the product flow
                  </IonButton>
                </div>
              </article>
            </div>
          </section>

          <section className="landing-cta-band">
            <div>
              <p className="landing-eyebrow">Why use BisaPilot</p>
              <h2>Use one system that reflects how the business actually runs day to day.</h2>
              <p>
                BisaPilot is for businesses that want cleaner records, better daily control, and fewer gaps between internal activity and what customers actually receive.
              </p>
            </div>
            <div className="landing-cta-actions">
              <IonButton size="large" onClick={() => history.push('/auth')}>
                Start with BisaPilot
              </IonButton>
              <IonButton size="large" fill="outline" color="dark" onClick={() => history.push('/auth')}>
                Sign in to workspace
              </IonButton>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default LandingPage;
