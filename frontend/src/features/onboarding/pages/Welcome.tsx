// src/components/welcome/Welcome.tsx
import { useMemo, useState } from "react";
import { ShieldCheck, Smartphone, BarChart3, Package, TrendingUp, Zap, PieChart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../../../assets/shopkeeper-logo.png";

function Dots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (index: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onDotClick(i)}
          className={`h-2 rounded-full transition-all duration-300 cursor-pointer focus:outline-none ${
            i === current
              ? "bg-gradient-to-r from-orange-500 to-yellow-500 w-6"
              : "bg-gray-300 dark:bg-gray-600 w-2 hover:bg-gray-400 dark:hover:bg-gray-500"
          }`}
        />
      ))}
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate();

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
        button: "Continue to Login",
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
        navigate("/sign-in");
      }
      setIsAnimating(false);
    }, 200);
  };

  const handleDotClick = (index: number) => {
    if (index === step || isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setStep(index);
      setIsAnimating(false);
    }, 200);
  };

  const handleSkipToLogin = () => {
    navigate("/sign-in");
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      {/* Top colored area */}
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

          <div className="relative">
            <div className="absolute -inset-4 bg-white/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative rounded-2xl bg-white/95 backdrop-blur-sm p-4 sm:p-6 shadow-2xl border-2 border-white/40">
              <div className="flex items-center justify-center">
                <img
                  src={logo}
                  alt="ShopKeeper logo"
                  className="h-12 sm:h-16 md:h-20 w-auto max-w-[280px]"
                  draggable={false}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = 'text-center';
                      fallback.innerHTML = `
                        <div class="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                          ShopKeeper
                        </div>
                        <div class="text-sm text-gray-600 mt-1">Sell Smarter, Grow Faster</div>
                      `;
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full opacity-70 blur-md"></div>
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-xl border-4 border-white">
                  <div className="relative flex flex-col items-center justify-center text-white p-1">
                    <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span className="mt-0.5 text-[9px] sm:text-[10px] font-bold tracking-wide">
                      TRUSTED
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-12 sm:h-16" preserveAspectRatio="none">
            <path
              fill="white"
              className="text-gray-50 dark:text-gray-900"
              d="M0,96 C360,60 720,120 1080,84 C1440,48 1440,120 1440,120 L1440,120 L0,120 Z"
            />
          </svg>
        </div>
      </div>

      {/* Content area */}
      <div className="h-2/3 sm:h-3/5 pt-10 sm:pt-12">
        <div className="h-full flex flex-col max-w-md mx-auto px-4 sm:px-6">
          <div
            key={step}
            className={`flex-1 flex flex-col justify-center transition-all duration-300 ${
              isAnimating ? 'opacity-0 transform translate-y-4' : 'opacity-100 transform translate-y-0'
            }`}
          >
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 text-center mb-3 sm:mb-4 px-2">
              {current.title}
            </h2>

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

            {/* Action button */}
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

            {/* Dots — clickable */}
            <div className="mt-4 sm:mt-6 px-2">
              <Dots total={slides.length} current={step} onDotClick={handleDotClick} />
            </div>

            {/* Skip option (only on first slide) */}
            {step === 0 && (
              <div className="mt-4 text-center">
                <button
                  className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  onClick={handleSkipToLogin}
                >
                  Skip to Login
                </button>
              </div>
            )}

            {/* QR code (only on first slide) */}
            {step === 0 && (
              <div className="mt-3 flex items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white/80 p-2 dark:border-gray-700 dark:bg-gray-800/80">
                <img
                  src="/app-access-qr.png"
                  alt="Scan to open ShopKeeper app"
                  className="h-14 w-14 rounded border border-gray-200 bg-white p-1 dark:border-gray-700"
                />
                <div className="text-left">
                  <p className="text-[11px] font-medium text-gray-900 dark:text-gray-100">Scan to open ShopKeeper</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Use this QR on any phone camera</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats footer */}
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