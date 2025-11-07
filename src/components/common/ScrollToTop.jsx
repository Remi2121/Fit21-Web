// components/common/ScrollToHash.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const id = hash.slice(1);
    const header = document.querySelector(".header");
    const headerH = header ? header.offsetHeight : 0;

    let tries = 0;
    const maxTries = 30; // ~0.5s if rAF ~16ms

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.pageYOffset - headerH - 4;
        window.scrollTo({ top: y, behavior: "smooth" });
        return;
      }
      if (tries < maxTries) {
        tries += 1;
        requestAnimationFrame(tryScroll);
      }
    };

    // Start attempts
    requestAnimationFrame(tryScroll);
  }, [pathname, hash]); // run when route OR hash changes

  return null;
}
