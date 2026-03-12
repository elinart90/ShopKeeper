import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Phone } from "lucide-react";
import { authApi } from "../../../lib/api";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const location = useLocation();
  const initialEmail = (location.state as { email?: string })?.email ?? "";

  const [step, setStep] = useState<"email" | "pin" | "password" | "done">("email");
  const [usePhone, setUsePhone] = useState(false);
  const [identifier, setIdentifier] = useState(initialEmail);
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError(usePhone ? "Enter your phone number" : "Enter your email address");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPasswordRequest(trimmed);
      toast.success("If that account exists, a PIN was sent to your registered phone number via SMS.");
      setStep("pin");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to send PIN. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length !== 6) {
      setError("Enter the 6-digit PIN");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.verifyForgotPasswordPin({ email: identifier.trim(), pin: pin.trim() });
      toast.success("PIN verified. Create your new password.");
      setStep("password");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Invalid or expired PIN. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPasswordReset({ email: identifier.trim(), pin: pin.trim(), newPassword });
      toast.success("Password reset successfully. You can now sign in.");
      setStep("done");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Invalid or expired PIN. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
      <Link
        to="/sign-in"
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Sign in
      </Link>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-600 mb-4">
            <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
            Reset password
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            {step === "email" && "Enter your email or phone to receive a 6-digit PIN"}
            {step === "pin" && "Enter the 6-digit PIN sent to your phone via SMS"}
            {step === "password" && "Create your new password"}
            {step === "done" && "Your password has been reset"}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === "email" && (
            <form onSubmit={handleSendPin} className="space-y-6">
              {/* Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setUsePhone(false); setIdentifier(initialEmail); setError(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!usePhone ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setUsePhone(true); setIdentifier(''); setError(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${usePhone ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                >
                  Phone number
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {usePhone ? 'Phone number' : 'Email address'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {usePhone ? <Phone className="h-5 w-5 text-gray-400" /> : <Mail className="h-5 w-5 text-gray-400" />}
                  </div>
                  <input
                    type={usePhone ? 'tel' : 'email'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder={usePhone ? '0552017649' : 'Enter your email'}
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {usePhone
                    ? 'Enter the phone number linked to your account'
                    : "We'll send a PIN to the phone number linked to this account"}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white btn-primary-gradient disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send 6-digit PIN"}
              </button>
            </form>
          )}

          {step === "pin" && (
            <form onSubmit={handleVerifyPin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  6-digit PIN
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-lg tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="000000"
                  autoFocus
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Enter the PIN sent via SMS to the phone linked to {identifier || "your account"}
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || pin.trim().length !== 6}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white btn-primary-gradient disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying…" : "Verify PIN"}
              </button>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Use a different email or phone
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleReset} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm new password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Confirm password"
                  minLength={8}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || pin.length !== 6 || !newPassword || newPassword !== confirmPassword}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white btn-primary-gradient disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Resetting…" : "Reset password"}
              </button>
              <button
                type="button"
                onClick={() => setStep("pin")}
                className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Back to PIN
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-6 text-center">
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                Password reset successfully. You can now sign in with your new password.
              </p>
              <Link
                to="/sign-in"
                className="block w-full py-3 px-4 rounded-xl font-semibold text-white btn-primary-gradient text-center"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>

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