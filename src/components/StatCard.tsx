type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  className?: string;
};

const StatCard: React.FC<StatCardProps> = ({ label, value, helper, className = '' }) => {
  return (
    <article className={`stat-card ${className}`}>
      <p className="muted-label">{label}</p>
      <h3>{value}</h3>
      <p>{helper}</p>
    </article>
  );
};

export default StatCard;
