type StatCardProps = {
  label: string;
  value: string;
  helper: string;
};

const StatCard: React.FC<StatCardProps> = ({ label, value, helper }) => {
  return (
    <article className="stat-card">
      <p className="muted-label">{label}</p>
      <h3>{value}</h3>
      <p>{helper}</p>
    </article>
  );
};

export default StatCard;
