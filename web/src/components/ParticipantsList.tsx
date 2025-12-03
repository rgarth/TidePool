interface ParticipantsListProps {
  participants: string[];
}

export function ParticipantsList({ participants }: ParticipantsListProps) {
  return (
    <div className="flex flex-col gap-sm">
      {participants.map((name, index) => (
        <div key={index} className="participant-item card card-compact">
          <div 
            className="participant-avatar"
            style={{ background: `hsl(${(name.charCodeAt(0) * 137) % 360}, 55%, 45%)` }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <span className="participant-name">{name}</span>
        </div>
      ))}
    </div>
  );
}

