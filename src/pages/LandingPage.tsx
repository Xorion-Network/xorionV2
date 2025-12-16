import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import { useNetworkStore } from '@/stores/networkStore';
import { useApiStore } from '@/stores/apiStore';
import Footer from '@/components/Footer';
import About from '@/components/About';
import CommunitySection from '@/components/Community';
import LandingNavbar from '@/components/LandingNavbar';
import LandingHero from '@/components/LandingHero';
import LandingFeatures from '@/components/LandingFeatures';

const LandingPage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { connect, apiState } = useApiStore();

  // Connect to the blockchain when landing page loads
  useEffect(() => {
    if (apiState.status === 'disconnected') {
      connect();
    }
  }, [connect, apiState.status]);

  const handleNavClick = (e, href) => {
    e.preventDefault();
    setIsOpen(false);

    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(href);
    }
  };

  const navItems = [
    { name: 'Features', href: '#features' },
    { name: 'About', href: '#about' },
    { name: 'Community', href: '#community' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none">
        <div className="floating-bg absolute top-20 left-10 w-48 h-48 md:w-96 md:h-96 bg-gradient-to-r from-pink-400/20 to-purple-500/20 rounded-full blur-3xl"></div>
        <div className="floating-bg absolute bottom-20 right-10 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-r from-purple-400/20 to-pink-500/20 rounded-full blur-3xl"></div>
        <div className="floating-bg absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-64 md:h-64 bg-gradient-to-r from-orange-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
      </div>

      <LandingNavbar
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        navItems={navItems}
        handleNavClick={handleNavClick}
        navigate={navigate}
      />
      <div className="pb-[86px] md:pb-[98px] lg:pb-[130px]"></div>
      <LandingHero navigate={navigate} />
      <LandingFeatures />
      <About />
      <CommunitySection />
      <Footer />
    </div>
  );
};

export default LandingPage;
