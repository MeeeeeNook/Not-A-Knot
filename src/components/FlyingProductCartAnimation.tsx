import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface FlyingCartItemData {
  id: string;
  image: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface FlyingProductCartAnimationProps {
  items: FlyingCartItemData[];
  onItemComplete: (id: string) => void;
}

export const FlyingProductCartAnimation: React.FC<FlyingProductCartAnimationProps> = ({
  items,
  onItemComplete,
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      <AnimatePresence>
        {items.map((item) => {
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

          // Safe padding to guarantee the floating card NEVER goes outside screen bounds
          const padX = 24;
          const padY = 20;

          const sX = Math.max(padX, Math.min(vw - padX - 44, item.startX));
          const sY = Math.max(padY + 20, Math.min(vh - padY - 56, item.startY));
          const eX = Math.max(padX, Math.min(vw - padX - 20, item.endX));
          const eY = Math.max(padY, Math.min(vh - padY, item.endY));

          // Miniature product card dimensions (46px x 56px)
          const cardW = 46;
          const cardH = 56;

          // Continuous parabolic apex - smooth single natural arc
          const verticalDist = Math.abs(sY - eY);
          const arcLift = Math.max(50, Math.min(120, verticalDist * 0.35 + 40));
          const apexY = Math.max(padY + 10, Math.min(sY, eY) - arcLift);

          return (
            <motion.div
              key={item.id}
              initial={{
                x: sX - cardW / 2,
                y: sY - cardH / 2,
                scale: 0.8,
                opacity: 1,
                rotate: 0,
              }}
              animate={{
                x: [sX - cardW / 2, eX - cardW / 2],
                y: [sY - cardH / 2, apexY - cardH / 2, eY - cardH / 2],
                scale: [0.85, 1.05, 0.95, 0.2],
                rotate: [0, -3, 6, 2],
              }}
              transition={{
                duration: 1.35,
                ease: [0.25, 0.9, 0.35, 1],
                y: {
                  times: [0, 0.45, 1],
                  ease: ['easeOut', 'easeIn'],
                },
                scale: {
                  times: [0, 0.2, 0.8, 1],
                  ease: 'easeInOut',
                },
              }}
              onAnimationComplete={() => onItemComplete(item.id)}
              className="absolute top-0 left-0 w-[46px] h-[56px] rounded-xl p-1 bg-white border-2 border-amber-400 shadow-2xl shadow-black/50 flex items-center justify-center pointer-events-none filter drop-shadow-xl z-[99999]"
              style={{ opacity: 1 }}
            >
              {/* Main Product Image inside mini card */}
              <div className="w-full h-full rounded-lg overflow-hidden bg-neutral-100 relative flex items-center justify-center">
                <img
                  src={item.image || '/assets/bracelet.jpg'}
                  alt="Sản phẩm vào giỏ"
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                  loading="eager"
                  style={{ opacity: 1 }}
                />
                {/* Clean golden border rim */}
                <div className="absolute inset-0 border border-amber-400/30 rounded-lg pointer-events-none" />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
