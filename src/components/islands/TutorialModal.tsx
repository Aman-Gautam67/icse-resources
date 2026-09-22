import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Search,
  FolderOpen,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Zap,
  BookOpen
} from 'lucide-react';
import { recordTutorialCompletion } from '../../lib/user-registry';

export interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

interface TutorialSlide {
  badge: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlights: {
    icon: React.ReactNode;
    title: string;
    text: string;
  }[];
}

const SLIDES: TutorialSlide[] = [
  {
    badge: "What's New in v2.0",
    title: "Welcome to the Upgraded ICSE Resources",
    description: "We've completely modernized the platform to make finding and downloading study materials faster, cleaner, and more reliable than ever.",
    icon: <Sparkles className="h-6 w-6 text-primary" />,
    highlights: [
      {
        icon: <BookOpen className="h-4 w-4 text-primary shrink-0" />,
        title: "6,500+ Curated Files",
        text: "Complete revision notes, specimen question papers, textbook solutions, and school prelims."
      },
      {
        icon: <Zap className="h-4 w-4 text-primary shrink-0" />,
        title: "Class 10 & 12 Materials",
        text: "Quickly toggle between Class 10 and Class 12 study spaces with syllabus alignment."
      }
    ]
  },
  {
    badge: "Instant Search",
    title: "Find Any Resource with Ctrl + K",
    description: "Search across all 11 subjects, prelim papers, and authors in milliseconds from anywhere on the website.",
    icon: <Search className="h-6 w-6 text-primary" />,
    highlights: [
      {
        icon: <Zap className="h-4 w-4 text-primary shrink-0" />,
        title: "Quick Keyboard Shortcut",
        text: "Press Ctrl + K (or Cmd + K on Mac) at any time to open Spotlight Search instantly."
      },
      {
        icon: <BookOpen className="h-4 w-4 text-primary shrink-0" />,
        title: "Smart Fuzzy Matching",
        text: "Search by school name, topic, chapter, or publication with instant typo tolerance."
      }
    ]
  },
  {
    badge: "Organized Navigation",
    title: "Clean Folders & Prelim Archive",
    description: "Folders start closed by default so you can focus on exactly what you need without getting overwhelmed by thousands of files.",
    icon: <FolderOpen className="h-6 w-6 text-primary" />,
    highlights: [
      {
        icon: <FolderOpen className="h-4 w-4 text-primary shrink-0" />,
        title: "School Prelims by Year",
        text: "Browse preliminary papers neatly organized by examination year and school."
      },
      {
        icon: <Check className="h-4 w-4 text-primary shrink-0" />,
        title: "100% Free & Open",
        text: "No accounts, no paywalls, and no login required. Your preferences stay on your device."
      }
    ]
  }
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Reset slide index when modal opens
  useEffect(() => {
    if (open) setCurrentSlide(0);
  }, [open]);

  const handleComplete = useCallback(() => {
    recordTutorialCompletion('completed');
    onClose();
  }, [onClose]);

  const handleSkip = useCallback(() => {
    recordTutorialCompletion('skipped');
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentSlide, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  }, [currentSlide]);

  // Keyboard navigation: Escape to skip, ArrowRight/Enter to advance, ArrowLeft to go back
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleNext, handlePrev, handleSkip]);

  if (!open) return null;

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-dialog-title"
        className="fixed z-[150] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xl animate-scale-in text-card-foreground"
      >
        {/* Top Header bar with Step Pill and Skip Button */}
        <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              {slide.icon}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {slide.badge}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {currentSlide + 1} of {SLIDES.length}
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent"
              title="Skip tutorial"
              aria-label="Skip tutorial"
            >
              <span className="hidden sm:inline">Skip</span>
              <X className="h-4 w-4 sm:hidden inline" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Slide Content */}
        <div className="space-y-4 min-h-[220px]">
          <div>
            <h2 id="tutorial-dialog-title" className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
              {slide.title}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
              {slide.description}
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 gap-2.5 pt-2">
            {slide.highlights.map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/70 bg-accent/30 text-xs leading-relaxed"
              >
                <div className="mt-0.5">{h.icon}</div>
                <div>
                  <strong className="font-semibold text-foreground block">{h.title}</strong>
                  <span className="text-muted-foreground">{h.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
          {/* Progress Dots */}
          <div className="flex items-center gap-1.5" aria-label="Tutorial progress">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to step ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentSlide
                    ? 'w-6 bg-primary'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                }`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {currentSlide > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold transition-colors"
                aria-label="Previous step"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
              aria-label={isLast ? 'Get started and close tutorial' : 'Next step'}
            >
              <span>{isLast ? 'Get Started' : 'Next'}</span>
              {isLast ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <ArrowRight size={15} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TutorialModal;
