type SectionCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const SectionCard: React.FC<SectionCardProps> = ({ title, subtitle, children }) => {
  return (
    <section className="section-card">
      <div className="section-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
};

export default SectionCard;
