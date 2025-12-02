interface ParticipantsListProps {
  participants: string[];
}

export function ParticipantsList({ participants }: ParticipantsListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {participants.map((name, index) => (
        <div 
          key={index} 
          className="card" 
          style={{ padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}
        >
          <div style={{
            width: '40px', 
            height: '40px', 
            borderRadius: '50%',
            background: `hsl(${(name.charCodeAt(0) * 137) % 360}, 60%, 50%)`,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white', 
            fontWeight: '600',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}

