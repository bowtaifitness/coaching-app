import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';

interface OnboardingTutorialModalProps {
  onClose: () => void;
}

interface Slide {
  images: string[];
  headline: string;
  text: string;
}

const slides: Slide[] = [
  {
    images: ['/images/IMG_8223.PNG', '/images/IMG_8224.PNG'],
    headline: 'Start Your Analysis',
    text: 'Tap the Swing tab at the bottom of your screen to get started. You can either tap Record Video with Camera to film a new swing or Choose File to upload an existing video directly from your Photo Library.',
  },
  {
    images: ['/images/IMG_8225.PNG', '/images/IMG_8226.PNG'],
    headline: 'Frame Your Shot',
    text: 'Use the green sliders to trim your video. For the best analysis, make sure your video includes your static setup, the full swing, and your complete follow-through (Max 10 seconds). Tap Apply Trim when you are ready.',
  },
  {
    images: ['/images/IMG_8227.PNG', '/images/IMG_8228.PNG'],
    headline: 'Discover Your Swing Faults',
    text: 'Sit back while our AI engine analyzes your biomechanics frame by frame. Within seconds, you will receive a detailed breakdown identifying your specific swing faults and their severity.',
  },
  {
    images: ['/images/IMG_8229.PNG'],
    headline: 'Set Your Frequency',
    text: 'How much time can you dedicate to improving your body and your game? Select how many days per week you want to train, ranging from a quick 1-day weekly tune-up to a 4-day intensive split.',
  },
  {
    images: ['/images/IMG_8230.PNG'],
    headline: 'Select Your Equipment',
    text: 'Whether you are working out in your living room with zero equipment, traveling with resistance bands, or using a fully stocked commercial gym, select your available equipment so we can tailor the exercises perfectly to you. Tap Generate Custom Program.',
  },
  {
    images: ['/images/IMG_8231.PNG'],
    headline: 'Your Custom Program is Ready',
    text: 'Your personalized 12-week progressive program has been built specifically to attack your swing faults. Review your customized corrective exercises for the current block, tap Start Program, and begin your first workout!',
  },
];

const SWIPE_THRESHOLD = 50;

const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({ onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const isLastSlide = currentIndex === slides.length - 1;

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= slides.length) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    setTimeout(() => setIsAnimating(false), 350);
  }, []);

  const handleNext = async () => {
    if (isLastSlide) {
      await Preferences.set({ key: 'hasSeenOnboardingTutorial', value: 'true' });
      onClose();
    } else {
      goTo(currentIndex + 1);
    }
  };

  const handleSkip = async () => {
    await Preferences.set({ key: 'hasSeenOnboardingTutorial', value: 'true' });
    onClose();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isAnimating) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontalSwipe.current) return;
    e.preventDefault();

    const bounded =
      (currentIndex === 0 && dx > 0) || (isLastSlide && dx < 0)
        ? dx * 0.3
        : dx;

    setOffsetX(bounded);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (Math.abs(offsetX) > SWIPE_THRESHOLD) {
      if (offsetX < 0 && currentIndex < slides.length - 1) {
        goTo(currentIndex + 1);
      } else if (offsetX > 0 && currentIndex > 0) {
        goTo(currentIndex - 1);
      }
    }

    setOffsetX(0);
    isHorizontalSwipe.current = null;
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const translateX =
    -(currentIndex * 100) +
    (offsetX / (containerRef.current?.offsetWidth || 400)) * 100;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        paddingLeft: 'max(env(safe-area-inset-left), 12px)',
        paddingRight: 'max(env(safe-area-inset-right), 12px)',
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Card -- constrained to 82vh max */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '82vh' }}
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-4 z-10 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wide"
        >
          Skip
        </button>

        {/* Scrollable carousel area */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-hidden touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex h-full"
            style={{
              transform: `translateX(${translateX}%)`,
              transition: isDragging
                ? 'none'
                : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {slides.map((slide, i) => (
              <div
                key={i}
                className="w-full flex-shrink-0 flex flex-col h-full px-5 pt-10 pb-2"
              >
                {/* Scrollable inner content */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
                  {/* Images */}
                  <div
                    className={`flex-1 min-h-0 flex ${
                      slide.images.length > 1 ? 'gap-2' : 'justify-center'
                    } items-center mb-3`}
                  >
                    {slide.images.map((src, imgIdx) => (
                      <img
                        key={imgIdx}
                        src={src}
                        alt={`${slide.headline} screenshot ${imgIdx + 1}`}
                        className={`object-contain rounded-xl shadow-md border border-gray-100 ${
                          slide.images.length > 1
                            ? 'max-h-full w-1/2'
                            : 'max-h-full max-w-[70%]'
                        }`}
                        draggable={false}
                      />
                    ))}
                  </div>

                  {/* Text content */}
                  <div className="flex-shrink-0 text-center px-1 pb-2">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1.5">
                      {slide.headline}
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {slide.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed footer: dots + button -- always visible */}
        <div className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-gray-100 flex flex-col items-center gap-3 bg-white">
          {/* Paging dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? 'w-5 h-2 bg-green-600'
                    : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          {/* Next / Let's Go button */}
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
          >
            {isLastSlide ? (
              "Let's Go!"
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorialModal;
