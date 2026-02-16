// src/features/auth/pages/SignUpPage.tsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, User, Eye, EyeOff, Lock, Globe, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../../../contexts/useAuth";
import toast from "react-hot-toast";

export default function SignUpPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    countryCode: "+233", // Ghana default
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userCountry, setUserCountry] = useState<string>("GH");
  
  // Password validation rules
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  // Detect user's country based on IP
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        const countryCode = data.country_code || "GH";
        
        // Find country dial code using the country code
        const dialCode = getDialCodeByCountryCode(countryCode);
        if (dialCode) {
          setUserCountry(countryCode);
          setFormData(prev => ({
            ...prev,
            countryCode: dialCode,
          }));
        }
      } catch (error) {
        console.log("Could not detect country, using default"+error);
      }
    };

    detectCountry();
  }, []);

  // Get dial code by country code
  const getDialCodeByCountryCode = (countryCode: string): string => {
    const country = commonCountries.find(c => c.code === countryCode);
    return country ? `+${country.dial}` : "+233";
  };

  // Validate password on change
  useEffect(() => {
    const password = formData.password;
    setPasswordValidation({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
    });
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    setErrors({});

    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = "First name must be at least 2 characters";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!isPasswordValid()) {
      newErrors.password = "Password does not meet requirements";
    }

    if (formData.phone && !/^\d+$/.test(formData.phone.replace(/\s+/g, ''))) {
      newErrors.phone = "Phone number should contain only digits";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      await register({
        name: formData.firstName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });
      toast.success("Account created. You are now signed in.");
      navigate("/dashboard", { replace: true });

    } catch (err: unknown) {
      console.error("Sign up error details:", err);
      if (err instanceof Error) {
        setErrors({ general: err.message });
      } else {
        setErrors({
          general: "Failed to create account. Please check your information and try again."
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const handleCountryCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({
      ...formData,
      countryCode: e.target.value,
    });
  };

  const isPasswordValid = () => {
    return Object.values(passwordValidation).every(Boolean);
  };

  // Common country codes for dropdown
  const commonCountries = [
    { code: "GH", dial: "233", name: "Ghana", flag: "🇬🇭" },
    { code: "US", dial: "1", name: "United States", flag: "🇺🇸" },
    { code: "GB", dial: "44", name: "United Kingdom", flag: "🇬🇧" },
    { code: "NG", dial: "234", name: "Nigeria", flag: "🇳🇬" },
    { code: "KE", dial: "254", name: "Kenya", flag: "🇰🇪" },
    { code: "ZA", dial: "27", name: "South Africa", flag: "🇿🇦" },
    { code: "IN", dial: "91", name: "India", flag: "🇮🇳" },
    { code: "CA", dial: "1", name: "Canada", flag: "🇨🇦" },
    { code: "AU", dial: "61", name: "Australia", flag: "🇦🇺" },
    { code: "FR", dial: "33", name: "France", flag: "🇫🇷" },
    { code: "DE", dial: "49", name: "Germany", flag: "🇩🇪" },
  ];

  // Get flag emoji
  const getCountryFlag = (countryCode: string) => {
    const country = commonCountries.find(c => c.code === countryCode);
    return country ? country.flag : "🇬🇭";
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
            Create your account
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Welcome! Please fill in the details to get started.
          </p>
        </div>

        {/* Signup card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          {/* General error */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {errors.general}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name section */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-3 py-3 border ${
                        errors.firstName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      } rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                      placeholder="First name"
                      required
                      minLength={2}
                      maxLength={50}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {errors.firstName}
                    </p>
                  )}
                </div>

                {/* Last Name (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span>Last name</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-normal ml-1">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`block w-full px-3 py-3 border ${
                        errors.lastName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      } rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                      placeholder="Last name"
                      maxLength={50}
                    />
                  </div>
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username <span className="text-gray-500 dark:text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border ${
                      errors.username ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                    placeholder="username"
                    pattern="^[a-zA-Z0-9_]+$"
                    maxLength={30}
                  />
                </div>
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {errors.username}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Letters, numbers, and underscores only
                </p>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email address *
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
                  className={`block w-full pl-10 pr-3 py-3 border ${
                    errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  } rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                  placeholder="you@example.com"
                  required
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                We'll send a verification code to this email
              </p>
            </div>

            {/* Phone number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone number <span className="text-gray-500 dark:text-gray-400 text-xs font-normal">(Optional)</span>
              </label>
              <div className="flex gap-2">
                {/* Country code dropdown */}
                <div className="relative flex-1 max-w-[140px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={formData.countryCode}
                    onChange={handleCountryCodeChange}
                    className="block w-full pl-10 pr-8 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none transition-all"
                  >
                    {commonCountries.map((country) => (
                      <option key={country.code} value={`+${country.dial}`}>
                        {country.flag} +{country.dial} ({country.code})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {/* Phone number input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border ${
                      errors.phone ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                    placeholder="1234567890"
                  />
                </div>
              </div>
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {errors.phone}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Detected country: {getCountryFlag(userCountry)} {userCountry} • Optional - for account recovery
              </p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password *
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
                  className={`block w-full pl-10 pr-10 py-3 border ${
                    errors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  } rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                  placeholder="Enter your password"
                  required
                  minLength={8}
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
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {errors.password}
                </p>
              )}
              
              {/* Password validation checklist */}
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium mb-1">Password requirements:</p>
                <div className="space-y-1">
                  {[
                    { condition: passwordValidation.length, text: "At least 8 characters" },
                    { condition: passwordValidation.uppercase, text: "One uppercase letter" },
                    { condition: passwordValidation.lowercase, text: "One lowercase letter" },
                    { condition: passwordValidation.number, text: "One number" },
                  ].map((req, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {req.condition ? (
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className={`text-xs ${req.condition ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="text-gray-600 dark:text-gray-400">
                  I agree to the{" "}
                  <Link to="/terms" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>

            {/* Continue button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300 ${
                isLoading
                  ? "btn-primary-gradient cursor-not-allowed opacity-70"
                  : "btn-primary-gradient shadow-lg"
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>

          </form>

          {/* Sign in link */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Already have an account?{" "}
              <Link
                to="/sign-in"
                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Stats footer */}
        <div className="mt-8 text-center">
          <div className="flex justify-center items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              Secure & Encrypted
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
              Free 14-day Trial
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
              No Credit Card Required
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}




// src/features/auth/pages/SignUpPage.tsx
// import { SignUp } from '@clerk/clerk-react';

// export default function SignUpPage() {
//   return (
//     <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
//       <SignUp 
//         signInUrl="/sign-in"
//         afterSignUpUrl="/dashboard"
//       />
//     </div>
//   );
// }