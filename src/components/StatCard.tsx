type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  className?: string;
  onClick?: () => void;
};

const StatCard: React.FC<StatCardProps> = ({ label, value, helper, className = '', onClick }) => {
  const interactiveProps = onClick
    ? {
        onClick,
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        },
        role: 'button' as const,
        tabIndex: 0,
      }
    : {};

  return (
    <article className={`stat-card ${className}`} {...interactiveProps}>
      <p className="muted-label">{label}</p>
      <h3>{value}</h3>
      <p>{helper}</p>
    </article>
  );
};

export default StatCard;
