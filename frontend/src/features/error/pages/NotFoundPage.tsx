// src/features/error/pages/NotFoundPage.tsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/useAuth";
import { Home, ArrowLeft, Search, AlertCircle } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoHome = () => {
    if (user) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-emerald-200 dark:bg-emerald-900 rounded-full opacity-20 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-orange-200 dark:bg-orange-900 rounded-full opacity-20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-200 dark:bg-blue-900 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {/* Outer glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 to-orange-500 rounded-full opacity-30 blur-xl animate-pulse"></div>
            
            {/* Icon container */}
            <div className="relative p-6 rounded-full bg-gradient-to-br from-emerald-500 to-orange-500 shadow-2xl">
              <AlertCircle className="h-16 w-16 sm:h-20 sm:w-20 text-white" />
            </div>
          </div>
        </div>

        {/* 404 Text */}
        <h1 className="text-8xl sm:text-9xl font-extrabold mb-4">
          <span className="bg-gradient-to-r from-emerald-600 via-blue-600 to-orange-500 bg-clip-text text-transparent">
            404
          </span>
        </h1>

        {/* Message */}
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Page Not Found
        </h2>
        
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto">
          Oops! The page you're looking for seems to have wandered off. Let's get you back on track.
        </p>

        {/* Search suggestion */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 mb-8 max-w-md mx-auto">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Search className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm text-left">
              The URL might be mistyped, or the page may have been moved or deleted.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={handleGoHome}
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold btn-primary-gradient shadow-lg flex items-center justify-center gap-2 group"
          >
            <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
            {user ? "Go to Dashboard" : "Go to Home"}
          </button>

          <button
            onClick={handleGoBack}
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 flex items-center justify-center gap-2 group"
          >
            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            Go Back
          </button>
        </div>

        {/* Helpful links */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Need help? Here are some useful links:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            {user ? (
              <>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                >
                  Dashboard
                </button>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <button
                  onClick={() => navigate("/support")}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                >
                  Support
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/sign-in")}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                >
                  Sign In
                </button>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <button
                  onClick={() => navigate("/sign-up")}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer decoration */}
      <div className="absolute bottom-4 left-0 right-0">
        <div className="flex justify-center items-center gap-6 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            Error Code: 404
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            ShoopKeeper
          </span>
        </div>
      </div>
    </div>
  );
}