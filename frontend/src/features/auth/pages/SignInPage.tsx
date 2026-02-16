import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "../../../contexts/useAuth";
import toast from "react-hot-toast";

export default function SignInPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    setError("");

    try {
      await login({ email: formData.email, password: formData.password });
      toast.success("Signed in successfully");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred during sign in. Please try again.");
      }
      console.error("Sign in error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSignIn = () => {
    // placeholder - no-op for now
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
      {/* Back button */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Welcome
      </Link>

      {/* Main card */}
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-600 mb-4">
            <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
            Sign in to ShopKeeper
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Welcome back! Please sign in to continue
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email address 
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Enter email or username"
                  required
                />
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <button
                  type="button"
                  onClick={handlePhoneSignIn}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
                >
                </button>
              </p>
            </div>

            {/* Password input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                  )}
                </button>
              </div>
              <div className="text-right mt-2">
                <Link
                  to="/forgot-password"
                  state={{ email: formData.email }}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            {/* Continue button */}
            <button
              type="submit"
              disabled={isLoading || !formData.email || !formData.password}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300 ${
                isLoading || !formData.email || !formData.password
                  ? "btn-primary-gradient cursor-not-allowed opacity-70"
                  : "btn-primary-gradient shadow-lg"
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </span>
              ) : (
                "Continue"
              )}
            </button>

          </form>

          {/* Sign up link */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Don't have an account?{" "}
              <Link
                to="/sign-up"
                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Security footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
            <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Your data is securely encrypted
          </p>
        </div>
      </div>
    </div>
  );
}



// src/features/auth/pages/SignInPage.tsx
// import { SignIn, useAuth } from '@clerk/clerk-react';
// import RedirectToDashboard from '../../error/pages/RedirectToDashboard';

// export default function SignInPage() {
//   const { isSignedIn, isLoaded } = useAuth();

//   // If already signed in, redirect
//   if (isLoaded && isSignedIn) {
//     return <RedirectToDashboard />;
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
//       <SignIn />
//     </div>
//   );
// }
