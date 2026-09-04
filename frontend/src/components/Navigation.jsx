import React from 'react';
import { Home, Network, ListFilter, Sliders, ShieldCheck, Camera, Brain, Info } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'overview', label: 'HOME', icon: Home },
    { id: 'network', label: 'TRAFFIC NETWORK', icon: Network },
    { id: 'events', label: 'EVENTS', icon: ListFilter },
    { id: 'signal', label: 'SIGNAL CONTROL', icon: Sliders },
    { id: 'safety-tests', label: 'SAFETY TESTS', icon: ShieldCheck },
    { id: 'vision', label: 'CCTV VISION', icon: Camera },
    { id: 'ai', label: 'AI REASONING', icon: Brain },
    { id: 'system', label: 'SYSTEM INFORMATION', icon: Info },
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
