// src/components/welcome/Welcome.tsx
import { useMemo, useState } from "react";
import { ShieldCheck, Smartphone, BarChart3, Package, TrendingUp, Zap, PieChart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../../../assets/shopkeeper-logo.png";

// type WelcomeProps = {
//   onNext?: () => void;
// };

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full transition-all duration-300 ${
            i === current 
              ? "bg-gradient-to-r from-orange-500 to-yellow-500 w-6" 
              : "bg-gray-300 dark:bg-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate(); // Add this hook
  
  const slides = useMemo(
    () => [
      {
        title: "Sell smarter, Grow faster",
        desc: "Manage your shop sales with your phone. No more forgotten transactions.",
        button: "Get Started",
        icon: <Smartphone className="h-10 w-10 sm:h-12 sm:w-12" />,
        bgGradient: "bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400",
      },
      {
        title: "Scan & Sell Fast",
        desc: "Use your phone camera or USB scanner to add items instantly.",
        button: "Next",
        icon: <Package className="h-10 w-10 sm:h-12 sm:w-12" />,
        bgGradient: "bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400",
        features: [
          { icon: <Zap className="h-4 w-4" />, text: "Quick barcode scanning" },
          { icon: <Zap className="h-4 w-4" />, text: "Instant item lookup" },
          { icon: <Zap className="h-4 w-4" />, text: "Fast checkout" }
        ]
      },
      {
        title: "Track Stock Easily",
        desc: "Know what is left, what is finished, and what to restock.",
        button: "Next",
        icon: <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12" />,
        bgGradient: "bg-gradient-to-br from-purple-600 via-purple-500 to-purple-400",
        features: [
          { icon: <PieChart className="h-4 w-4" />, text: "Real-time stock levels" },
          { icon: <PieChart className="h-4 w-4" />, text: "Low stock alerts" },
          { icon: <PieChart className="h-4 w-4" />, text: "Auto reorder suggestions" }
        ]
      },
      {
        title: "See Profit Clearly",
        desc: "Daily sales, expenses, and profit—ready for reports anytime.",
        button: "Continue to Login", // CHANGED: Updated button text
        icon: <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12" />,
        bgGradient: "bg-gradient-to-br from-orange-600 via-orange-500 to-orange-400",
        features: [
          { icon: <TrendingUp className="h-4 w-4" />, text: "Daily profit reports" },
          { icon: <TrendingUp className="h-4 w-4" />, text: "Expense tracking" },
          { icon: <TrendingUp className="h-4 w-4" />, text: "Revenue insights" }
        ]
      },
    ],
    []
  );

  const [step, setStep] = useState(0);
  const current = slides[step];
  const [isAnimating, setIsAnimating] = useState(false);

  const handleNext = () => {
    setIsAnimating(true);
    
    setTimeout(() => {
      if (step < slides.length - 1) {
        setStep((s) => s + 1);
      } else {
        // CHANGED: Navigate to login page instead of onNext
        navigate("/sign-in");
      }
      setIsAnimating(false);
    }, 200);
  };

  // CHANGED: Direct skip to login
  const handleSkipToLogin = () => {
    navigate("/sign-in");
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      {/* Top colored area - fixed height */}
      <div className={`relative overflow-hidden ${current.bgGradient} h-1/3 sm:h-2/5 transition-all duration-500`}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20px 20px, white 2%, transparent 0%), radial-gradient(circle at 60px 60px, white 2%, transparent 0%)`,
            backgroundSize: '80px 80px'
          }}></div>
        </div>

        {/* Logo and title section */}
        <div className="relative h-full flex flex-col items-center justify-center px-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white text-center drop-shadow-lg mb-4 sm:mb-6">
            WELCOME TO <span className="text-yellow-300">SHOPKEEPER</span>!
          </h1>

          {/* Logo container - made more prominent */}
          <div className="relative">
            {/* Logo shadow/glow effect */}
            <div className="absolute -inset-4 bg-white/20 rounded-full blur-xl animate-pulse"></div>
            
            {/* Logo box */}
            <div className="relative rounded-2xl bg-white/95 backdrop-blur-sm p-4 sm:p-6 shadow-2xl border-2 border-white/40">
              <div className="flex items-center justify-center">
                  <img
                    src={logo}
                    alt="ShoopKeeper logo"
                    className="h-12 sm:h-16 md:h-20 w-auto max-w-[280px]"
                    draggable={false}
                    onError={(e) => {
                      // Fallback if logo doesn't load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'text-center';
                        fallback.innerHTML = `
                          <div class="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                            ShoopKeeper
                          </div>
                          <div class="text-sm text-gray-600 mt-1">Sell Smarter, Grow Faster</div>
                        `;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
            </div>

            {/* Trust badge - positioned absolutely within the colored section */}
            
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            className="w-full h-12 sm:h-16"
            preserveAspectRatio="none"
          >
            <path
              fill="white"
              className="text-gray-50 dark:text-gray-900"
              d="M0,96 C360,60 720,120 1080,84 C1440,48 1440,120 1440,120 L1440,120 L0,120 Z"
            />
          </svg>
        </div>
        
      </div>
              <div className="absolute bottom-105 left-1/2 transform -translate-x-1/2">
              <div className="relative">
                {/* Outer glow */}
                <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full opacity-70 blur-md"></div>
                
                {/* Main badge */}
                <div className="relative h-24 w-34 sm:h-28 sm:w-28 flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-xl border-10 border-white">
                  <div className="relative flex flex-col items-center justify-center text-white p-2">
                    <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10" />
                    <span className="mt-1 text-xs sm:text-sm font-bold tracking-wide">
                      TRUSTED
                    </span>
                  </div>
                </div>
              </div>
            </div>
      {/* Content area - fixed height, no scroll */}
      <div className="h-2/3 sm:h-3/5 pt-10 sm:pt-12">
        <div className="h-full flex flex-col max-w-md mx-auto px-4 sm:px-6">
          {/* Slide content */}
          <div 
            key={step}
            className={`flex-1 flex flex-col justify-center transition-all duration-300 ${
              isAnimating ? 'opacity-0 transform translate-y-4' : 'opacity-100 transform translate-y-0'
            }`}
          >
            {/* Icon */}
            {/* <div className="flex justify-center mb-4 sm:mb-6">
              <div className="p-3 sm:p-4 rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-700 shadow-lg">
                {current.icon}
              </div>
            </div> */}

            {/* Title */}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 text-center mb-3 sm:mb-4 px-2">
              {current.title}
            </h2>

            {/* Description */}
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 text-center mb-6 sm:mb-8 px-2">
              {current.desc}
            </p>

            {/* Progress bar */}
            <div className="mb-4 px-2">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500 rounded-full"
                  style={{ width: `${((step + 1) / slides.length) * 100}%` }}
                ></div>
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center">
                Step {step + 1} of {slides.length}
              </div>
            </div>

            {/* Action button - positioned at bottom */}
            <div className="mt-4 px-2">
              <button
                className={`btn-african w-full py-3 sm:py-4 text-base sm:text-lg font-bold relative overflow-hidden ${
                  isAnimating ? 'transform scale-95' : ''
                }`}
                type="button"
                onClick={handleNext}
                disabled={isAnimating}
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
                <span className="relative flex items-center justify-center gap-2">
                  {current.button}
                  {step === slides.length - 1 && (
                    <span className="animate-pulse">🚀</span>
                  )}
                </span>
              </button>
            </div>

            {/* Dots indicator */}
            <div className="mt-4 sm:mt-6 px-2">
              <Dots total={slides.length} current={step} />
            </div>

            {/* Skip option (only on first slide) */}
            {step === 0 && (
              <div className="mt-4 text-center">
                <button
                  className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  onClick={handleSkipToLogin} // CHANGED: Use new skip function
                >
                  Skip to Login {/* CHANGED: Updated text */}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats footer - fixed at bottom */}
      <div className="absolute bottom-2 sm:bottom-4 left-0 right-0">
        <div className="max-w-md mx-auto px-4">
          <div className="flex justify-center items-center gap-3 sm:gap-6 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              5,000+ Shops
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse"></div>
              99% Uptime
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-500 rounded-full animate-pulse"></div>
              24/7 Support
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}