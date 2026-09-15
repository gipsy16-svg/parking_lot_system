import { useEffect, useLayoutEffect, useState } from "react";
import App from "./App.jsx";
import Home from "./Home.jsx";

const dashboardSections = new Set([
  "#overview",
  "#parking",
  "#queue",
  "#records",
  "#arrival",
]);

export default function Site() {
  const [hash, setHash] = useState(() => window.location.hash);
  const isDashboard = dashboardSections.has(hash);

  useEffect(() => {
    const handleNavigation = () => setHash(window.location.hash);
    window.addEventListener("hashchange", handleNavigation);
    return () => window.removeEventListener("hashchange", handleNavigation);
  }, []);

  useLayoutEffect(() => {
    document.title = isDashboard
      ? "Dashboard | Parkspace"
      : "Parkspace | A smoother way to park";
    const target = document.getElementById(hash.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: "instant", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [hash, isDashboard]);

  return isDashboard ? <App /> : <Home />;
}
