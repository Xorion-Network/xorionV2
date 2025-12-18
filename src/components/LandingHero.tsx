import React, { useEffect, useState } from 'react';

const LandingHero = ({ navigate }) => {
  const [networkMetrics, setNetworkMetrics] = useState({
    validatorsOnline: 0,
    avgBlockTime: 0,
    networkHealth: 0,
    activeAddresses: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    // Simulate API connection check
    const checkApiConnection = async () => {
      try {
        // Replace with your actual API endpoint
        // const response = await fetch('YOUR_API_ENDPOINT/status');
        // if (response.ok) setApiConnected(true);
        
        // Simulated connection for demo
        setTimeout(() => setApiConnected(true), 500);
      } catch (error) {
        console.error('API connection failed:', error);
      }
    };

    checkApiConnection();
  }, []);

  useEffect(() => {
    // Fetch network data when API is connected
    const fetchNetworkData = async () => {
      if (!apiConnected) return;
      
      setIsLoading(true);
      try {
        // Replace with your actual API endpoint
        // const response = await fetch('YOUR_API_ENDPOINT/network-metrics');
        // const data = await response.json();
        // setNetworkMetrics(data);
        
        // Simulated data for demo
        setTimeout(() => {
          setNetworkMetrics({
            validatorsOnline: 142,
            avgBlockTime: 6.2,
            networkHealth: 99.8,
            activeAddresses: 1247
          });
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Failed to fetch network data:', error);
        setIsLoading(false);
      }
    };

    fetchNetworkData();
    
    // Optional: Set up polling for real-time updates
    const interval = setInterval(fetchNetworkData, 30000); // Update every 30s
    
    return () => clearInterval(interval);
  }, [apiConnected]);

  return (
    <section className="pt-16 pb-8 px-4 sm:px-6 lg:px-8 glass-card" id="hero">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center px-4 py-2 glass-card rounded-full text-sm font-medium text-white mb-8">
          <span>✨ Next-gen blockchain explorer on xorion</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold gradient-blue-purple bg-clip-text text-transparent mb-6 leading-tight">
          Explore the Blockchain
          <br />
          <span className="text-primary">Effortlessly</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Your comprehensive portal for real-time network statistics, staking insights, and transaction tracking.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            className="bg-gradient-to-r from-blue-500 to-pink-500 text-white px-8 py-4 rounded-full font-semibold shadow hover:bg-primary/90 transition-all flex items-center justify-center"
            onClick={() => navigate('/explorer')}
          >
            Explore
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-12 max-w-3xl mx-auto">
          {[
            "Real-time Transaction Tracking",
            "Advanced Block Analysis", 
            "Address Monitoring",
            "Smart Contract Insights"
          ].map((feature, index) => (
            <span 
              key={index}
              className="inline-flex items-center px-4 py-2 glass-card/80 backdrop-blur-sm text-foreground text-sm font-medium rounded-full border border-border shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
              {feature}
            </span>
          ))}
        </div>
        
        {/* Real-time Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-4xl mx-auto">
          <div className="bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border">
            <div className="text-2xl font-bold text-primary mb-1">
              {isLoading ? (
                <div className="animate-pulse bg-muted h-6 w-8 rounded"></div>
              ) : (
                networkMetrics.validatorsOnline
              )}
            </div>
            <div className="text-sm text-muted-foreground">Validators</div>
          </div>
          
          <div className="bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border">
            <div className="text-2xl font-bold text-primary mb-1">
              {isLoading ? (
                <div className="animate-pulse bg-muted h-6 w-8 rounded"></div>
              ) : (
                `${networkMetrics.avgBlockTime}s`
              )}
            </div>
            <div className="text-sm text-muted-foreground">Block Time</div>
          </div>
          
          <div className="bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border">
            <div className="text-2xl font-bold text-primary mb-1">
              {isLoading ? (
                <div className="animate-pulse bg-muted h-6 w-8 rounded"></div>
              ) : (
                `${networkMetrics.networkHealth.toFixed(1)}%`
              )}
            </div>
            <div className="text-sm text-muted-foreground">Network Health</div>
          </div>
          
          <div className="bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border">
            <div className="text-2xl font-bold text-primary mb-1">
              {isLoading ? (
                <div className="animate-pulse bg-muted h-6 w-8 rounded"></div>
              ) : (
                networkMetrics.activeAddresses
              )}
            </div>
            <div className="text-sm text-muted-foreground">Active Addresses</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
