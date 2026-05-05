import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, UserCheck, Clock } from 'lucide-react';

interface UserCardProps {
  user: any;
  isFollowing?: boolean;
  isRequested?: boolean;
  onFollow?: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, isFollowing, isRequested, onFollow }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-black-soft rounded-2xl border border-gold/20 shadow-xl hover:border-gold/40 transition-all group">
      <Link to={`/profile/${user.uid}`} className="flex items-center space-x-4 flex-1">
        <img 
          src={user.photoURL} 
          alt={user.username} 
          className="w-12 h-12 rounded-full object-cover border border-gold/20"
          referrerPolicy="no-referrer"
        />
        <div>
          <p className="font-bold text-white group-hover:text-gold transition-colors">@{user.username}</p>
          <p className="text-sm text-gold/60 truncate max-w-[150px]">{user.displayName || user.username}</p>
        </div>
      </Link>
      
      {onFollow && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            onFollow();
          }}
          className={`p-2 rounded-xl transition-all ${
            isFollowing 
              ? 'bg-gold/10 text-gold hover:bg-gold/20' 
              : isRequested
                ? 'bg-black-soft text-gold/40 border border-gold/20'
                : 'bg-gold text-black hover:bg-gold-light shadow-lg shadow-gold/20'
          }`}
        >
          {isFollowing ? <UserCheck size={20} /> : isRequested ? <Clock size={20} /> : <UserPlus size={20} />}
        </button>
      )}
    </div>
  );
};
