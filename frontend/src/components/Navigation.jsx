import { Home, Navigation as NavIcon, Search, Camera, BarChart3, ShieldAlert, Video, Network, Sliders, ShieldCheck, Brain, Info } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'overview', label: 'OVERVIEW', icon: Home },
    { id: 'gis', label: 'GIS TRAJECTORY MAP', icon: NavIcon },
    { id: 'search', label: 'PLATE SEARCH', icon: Search },
    { id: 'anpr', label: 'ANPR / OCR', icon: Camera },
    { id: 'analytics', label: 'ANALYTICS', icon: BarChart3 },
    { id: 'watchlist', label: 'WATCHLIST & ALERTS', icon: ShieldAlert },
    { id: 'vision', label: 'CCTV FEEDS', icon: Video },
    { id: 'network', label: 'INTERSECTIONS', icon: Network },
    { id: 'signal', label: 'SIGNAL STATUS', icon: Sliders },
    { id: 'safety-tests', label: 'SAFETY TESTS', icon: ShieldCheck },
    { id: 'ai', label: 'AI REASONING', icon: Brain },
    { id: 'system', label: 'SYSTEM INFO', icon: Info },
  ];

  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(`section-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="gov-nav-bar">
      {navItems.map((item) => {
        const IconComp = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => scrollToSection(item.id)}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <IconComp size={14} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
