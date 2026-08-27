"use client";

import { BellRing, X, Sparkles, CheckCircle2 } from "lucide-react";

export default function NotificationModal({ isOpen, onClose, onNotifyMe }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-black/[0.08] overflow-hidden p-6 relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all active:scale-95"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="text-center space-y-4 pt-2 pb-1">
          {/* Animated Icon Badge */}
          <div className="relative inline-flex items-center justify-center pt-1">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center border border-brand/20 shadow-inner">
              <BellRing className="w-8 h-8 text-brand animate-bounce" />
            </div>
            <span className="absolute -top-2 -right-4 bg-amber-400 text-slate-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs border border-amber-500/20 z-10">
              <Sparkles className="w-3 h-3 fill-slate-900" /> SOON
            </span>
          </div>

          {/* Heading */}
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Notifications Coming Soon!
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed px-2">
              We&apos;re crafting real-time alerts so you never miss price drops, new rooms near your location, or messages from landlords.
            </p>
          </div>

          {/* Features Preview Chip Grid */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-left space-y-2 text-[12px] text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
              <span>Instant price drop alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
              <span>New listings matching your search</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
              <span>Owner response updates</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => {
                if (onNotifyMe) onNotifyMe();
                onClose();
              }}
              className="w-full py-2.5 bg-brand hover:bg-brand-dark active:scale-[0.98] text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Keep Me Posted
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
