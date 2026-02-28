"use client";

import { useEffect, useState } from "react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={scrollToTop}
      className={`fixed right-4 bottom-5 z-40 h-11 w-11 rounded-full shadow-lg transition
                  bg-white/95 text-black hover:bg-white active:translate-y-0.5
                  border border-black/10 backdrop-blur ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-6 w-6 mx-auto"
      >
        <path d="M12 4l-7 7h4v7h6v-7h4z" />
      </svg>
    </button>
  );
}
