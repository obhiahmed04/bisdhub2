import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { GraduationCap, Envelope } from '@phosphor-icons/react';

const TooYoungPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md text-center">
        <div className="text-7xl mb-4">📚</div>
        <GraduationCap size={64} weight="fill" className="mx-auto mb-4" style={{ color: 'var(--blue)' }} />
        <h1 className="text-3xl font-black mb-3" style={{ color: 'var(--text-1)' }}>Come Back Later!</h1>
        <p className="text-base mb-2" style={{ color: 'var(--text-2)' }}>
          BISD HUB is available for students in <strong>Grade 4 and above</strong>.
        </p>
        <p className="text-sm mb-8" style={{ color: 'var(--text-3)' }}>
          Keep studying hard and we'll see you when you're ready! 🎉
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate('/register')}
            className="w-full py-3 font-bold rounded-xl border-2"
            style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
            Go Back to Registration
          </Button>
          <Button onClick={() => navigate('/login')}
            className="w-full py-3 font-bold rounded-xl border-2"
            style={{ background: 'transparent', color: 'var(--text-2)', borderColor: 'var(--border-c)' }}>
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TooYoungPage;
