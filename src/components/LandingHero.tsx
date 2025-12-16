spaner React, { useEffect } from 'react';
import { useNetworkStore } from '@/stores/networkStore';
import { useApiStore } from '@/stores/apiStore';

const LandingHero = ({ navigate }) => {
  const { apiState } = useApiStore();
  const { 
    networkMetrics, 
    fetchNetworkData, 
    isLoading 
  } = useNetworkStore();

  useEffect(() => {
    // Fetch network data when component mounts
    if (apiState.status === 'connected') {
      fetchNetworkData();
    }
  }, [apiState.status, fetchNetworkData]);

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
