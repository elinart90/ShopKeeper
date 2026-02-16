// src/features/auth/components/RedirectToDashboard.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

export default function RedirectToDashboard() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    console.log('RedirectToDashboard - isLoaded:', isLoaded, 'isSignedIn:', isSignedIn);
    
    if (isLoaded && isSignedIn) {
      console.log('Redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}