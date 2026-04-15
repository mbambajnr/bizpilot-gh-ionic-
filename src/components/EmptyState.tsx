type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  message: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({ eyebrow, title, message }) => {
  return (
    <div className="empty-state">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
};

export default EmptyState;
