import React from 'react';
import { useSockets } from '../hooks/useSockets';

interface LeaveServerButtonProps {
  host: string;
  className?: string;
  children?: React.ReactNode;
}

export const LeaveServerButton: React.FC<LeaveServerButtonProps> = ({ 
  host, 
  className = "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors",
  children = "Leave Server"
}) => {
  const { leaveServer } = useSockets();

  const handleLeaveServer = () => {
    if (window.confirm(`Are you sure you want to leave the server ${host}?`)) {
      leaveServer(host);
    }
  };

  return (
    <button 
      onClick={handleLeaveServer}
      className={className}
    >
      {children}
    </button>
  );
};
