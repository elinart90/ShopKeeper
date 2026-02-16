// src/features/auth/pages/SsoCallbackPage.tsx
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
//import { useNavigate } from "react-router-dom";

export default function SsoCallbackPage() {
  //const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
      <div className="text-center">
        {/* Loading spinner */}
        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-600 mb-6">
          <div className="h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Completing sign in...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we finish setting up your account
        </p>
      </div>

      {/* Clerk's OAuth callback handler */}
      <AuthenticateWithRedirectCallback
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
        redirectUrl="/dashboard"
        signInUrl="/dashboard"
        signUpUrl="/sign-up"
        continueSignUpUrl="/verify-email"
      />  
    </div>
  );
}