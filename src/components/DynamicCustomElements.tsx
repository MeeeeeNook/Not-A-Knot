import React from 'react';
import { CustomElementBlock } from '../types';
import { Sparkles, ArrowRight, CheckCircle2, HelpCircle, ShieldCheck, Star } from 'lucide-react';

interface DynamicCustomElementsProps {
  elements?: CustomElementBlock[];
  onActionClick?: (link?: string) => void;
}

export const DynamicCustomElements: React.FC<DynamicCustomElementsProps> = ({
  elements = [],
  onActionClick
}) => {
  const activeElements = elements
    .filter((e) => e.isActive)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (activeElements.length === 0) return null;

  const handleLink = (link?: string) => {
    if (!link) return;
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else if (link.startsWith('#')) {
      window.location.hash = link;
    } else if (onActionClick) {
      onActionClick(link);
    }
  };

  return (
    <div id="dynamic-custom-elements-container" className="w-full space-y-10 sm:space-y-14 py-10 bg-[#0C0D11]">
      {activeElements.map((elem) => {
        // Render according to style or type
        if (elem.type === 'guarantee') {
          return (
            <div key={elem.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-gradient-to-r from-amber-500/10 via-neutral-900 to-amber-500/10 border border-amber-400/30 rounded-3xl p-6 sm:p-10 relative overflow-hidden shadow-2xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-center md:text-left">
                    {elem.badge && (
                      <span className="text-amber-300 text-xs font-bold uppercase tracking-wider block">
                        {elem.badge}
                      </span>
                    )}
                    <h3 className="text-2xl sm:text-3xl font-black text-white">{elem.title}</h3>
                    {elem.subtitle && <p className="text-neutral-400 text-xs sm:text-sm">{elem.subtitle}</p>}
                    <p className="text-neutral-200 text-xs sm:text-sm max-w-2xl leading-relaxed whitespace-pre-line pt-1">
                      {elem.content}
                    </p>
                  </div>

                  {elem.buttonText && (
                    <button
                      onClick={() => handleLink(elem.buttonLink)}
                      className="px-6 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs sm:text-sm transition-all flex items-center gap-2 flex-shrink-0 shadow-lg"
                    >
                      <span>{elem.buttonText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }

        if (elem.type === 'faq') {
          return (
            <div key={elem.id} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-[#14161F] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl">
                <div className="text-center mb-6">
                  {elem.badge && (
                    <span className="text-amber-300 text-xs font-bold uppercase tracking-wider block mb-1">
                      {elem.badge}
                    </span>
                  )}
                  <h3 className="text-2xl sm:text-3xl font-bold text-white">{elem.title}</h3>
                  {elem.subtitle && <p className="text-neutral-400 text-xs sm:text-sm mt-1">{elem.subtitle}</p>}
                </div>

                <div className="bg-white/5 rounded-2xl p-5 sm:p-6 border border-white/5 text-neutral-200 text-xs sm:text-sm leading-relaxed whitespace-pre-line space-y-3">
                  {elem.content}
                </div>

                {elem.buttonText && (
                  <div className="text-center mt-6">
                    <button
                      onClick={() => handleLink(elem.buttonLink)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-all"
                    >
                      <span>{elem.buttonText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Default or Custom Card / Banner
        return (
          <div key={elem.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#14161F] border border-white/10 rounded-3xl p-6 sm:p-10 relative overflow-hidden shadow-xl">
              {elem.imageUrl && (
                <img
                  src={elem.imageUrl}
                  alt={elem.title}
                  className="absolute right-0 top-0 w-1/3 h-full object-cover opacity-15 hidden md:block"
                />
              )}
              <div className="relative z-10 max-w-2xl space-y-3">
                {elem.badge && (
                  <span className="text-amber-300 text-xs font-bold uppercase tracking-wider block">
                    {elem.badge}
                  </span>
                )}
                <h3 className="text-2xl sm:text-3xl font-bold text-white">{elem.title}</h3>
                {elem.subtitle && <p className="text-neutral-400 text-xs sm:text-sm">{elem.subtitle}</p>}
                <p className="text-neutral-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                  {elem.content}
                </p>

                {elem.buttonText && (
                  <div className="pt-2">
                    <button
                      onClick={() => handleLink(elem.buttonLink)}
                      className="px-6 py-2.5 rounded-full bg-white text-black hover:bg-neutral-200 font-bold text-xs transition-all inline-flex items-center gap-2"
                    >
                      <span>{elem.buttonText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
