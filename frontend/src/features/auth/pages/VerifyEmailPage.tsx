// src/features/auth/pages/VerifyEmailPage.tsx
import { useState } from "react";
import { useSignUp } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function VerifyEmailPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLoaded) return;
    
    setIsLoading(true);
    setError("");

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === "complete") {
        setIsSuccess(true);
        
        // Show success message briefly before redirect
        setTimeout(async () => {
          try {
            await setActive({ session: result.createdSessionId });
            navigate("/app"); // Changed from /dashboard to /app
          } catch (err) {
            console.error("Error setting active session:", err);
            // If setting session fails, redirect to sign-in
            navigate("/sign-in");
          }
        }, 1500);
      }
    } catch (err: unknown) {
      // Type-safe error extraction
      if (err && typeof err === 'object' && 'errors' in err) {
        const errorObj = err as { errors?: Array<{ message?: string }> };
        const firstError = errorObj.errors?.[0];
        setError(firstError?.message || "Invalid verification code");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid verification code");
      }
      
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded) return;
    
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      // Show success feedback for resend
      const resendBtn = document.getElementById("resend-button");
      if (resendBtn) {
        resendBtn.textContent = "✓ Code sent!";
        setTimeout(() => {
          if (resendBtn) resendBtn.textContent = "Resend verification code";
        }, 2000);
      }
    } catch (err: unknown) {
      console.error("Error resending code:", err);
      setError("Failed to resend verification code");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Back button */}
      <Link 
        to="/sign-up" 
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Sign Up
      </Link>

      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {isSuccess ? (
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 mb-4 animate-pulse">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-600 mb-4">
                <Mail className="h-10 w-10 text-white" />
              </div>
            )}
            
            {isSuccess ? (
              <>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                  Email Verified!
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  Your email has been successfully verified. Redirecting to your dashboard...
                </p>
                <div className="mt-4 flex justify-center">
                  <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                </div>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
                  Verify your email
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  We've sent a 6-digit verification code to your email address
                </p>
              </>
            )}
          </div>

          {!isSuccess && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-shake">
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-center text-2xl tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    required
                    disabled={isLoading}
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                    Enter the 6-digit code from your email
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !isLoaded || code.length !== 6}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center ${
                    isLoading || !isLoaded || code.length !== 6
                      ? "btn-primary-gradient cursor-not-allowed opacity-70"
                      : "btn-primary-gradient shadow-lg"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Email"
                  )}
                </button>

                <div className="text-center">
                  <button
                    id="resend-button"
                    type="button"
                    onClick={handleResendCode}
                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  >
                    Resend verification code
                  </button>
                  
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <p>Didn't receive the code? Check your spam folder or</p>
                    <Link to="/sign-up" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                      try a different email
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Success overlay */}
          {isSuccess && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg">
                <CheckCircle className="h-4 w-4" />
                <span>Successfully verified! Redirecting...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}