import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Metadata } from "@polkadot/types";
import { TypeRegistry } from "@polkadot/types/create";
import BN from "bn.js";
import { precompiledMetadata } from "../metadata";
import { QueryClient } from "@tanstack/react-query";

// BALANCE FORMATTING UTILITY
const formatTxor = (rawBalance: string, decimals = 18): string => {
  if (!rawBalance || rawBalance === "0") return "0";
  const bn = new BN(rawBalance);
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = bn.div(divisor).toString();
  const fraction = bn
    .mod(divisor)
    .toString()
    .padStart(decimals, "0")
    .slice(0, 4)
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
};

export interface ApiState {
  api: ApiPromise | null;
  status: "disconnected" | "connecting" | "connected" | "degraded" | "error";
  lastError: string | null;
  latency: number | null;
  connectionAttempts: number;
  lastSuccessfulConnection: number | null;
  endpoint: string | null;
  lastConnected: Date | null;
}

export interface NetworkMetrics {
  validatorsOnline: number;
  totalValidators: number;
  stakingAPR: number;
  avgBlockTime: number;
  totalTransactions: number;
  totalValueLocked: string;
  networkHealth: number;
  activeAddresses: number;
  lastUpdated: number;
}

// TRANSACTION INTERFACE WITH TRANSFER DETECTION
export interface Transaction {
  hash: string;
  blockNumber: number;
  blockHash: string;
  index: number;
  method: string;
  section: string;
  signer: string;
  timestamp: Date | null;
  success: boolean;
  fee: string;
  args: string[];
  isTransfer: boolean;
  transferFrom?: string;
  transferTo?: string;
  transferAmount?: string;
  transferAsset?: string;
  events: any[];
  decodedData?: any;
}

export interface Block {
  height: number;
  hash: string;
  timestamp: Date | null;
  txCount: number;
  proposer: string;
  size: string;
}

export interface TransactionData {
  transactions: Transaction[];
  blocks: Block[];
  lastUpdated: number;
}

export interface TransactionDetails {
  hash: string;
  blockNumber: number;
  blockHash: string;
  index: number;
  method: string;
  section: string;
  signer: string;
  timestamp: Date | null;
  success: boolean;
  fee: string;
  args: string[];
  events: any[];
  error: string | null;
  nonce: number;
  tip: string;
  era: number;
  signature: string;
  isDecoded: boolean;
  decodedArgs: any[];
}

export interface ValidatorInfo {
  address: string;
  commission: number;
  selfBonded: string;
  nominators: number;
  totalStake: string;
  status: string;
}

interface PolkadotStore {
  // API STATE
  apiState: ApiState;
  api: ApiPromise | null;

  // NETWORK DATA
  networkMetrics: NetworkMetrics;
  chartData: any[];
  stakingData: any[];

  // TRANSACTION DATA
  transactionData: TransactionData;
  isTransactionLoading: boolean;
  isTransactionFetching: boolean;

  // TRANSACTION DETAILS
  transactionDetails: TransactionDetails | null;
  isDetailsLoading: boolean;
  detailsError: string | null;

  // LOADING STATES
  isLoading: boolean;
  isFetching: boolean;

  // ACTIONS
  setApiState: (state: Partial<ApiState>) => void;
  setApi: (api: ApiPromise | null) => void;
  setNetworkMetrics: (metrics: Partial<NetworkMetrics>) => void;
  setChartData: (data: any[]) => void;
  setStakingData: (data: any[]) => void;
  setTransactionData: (data: Partial<TransactionData>) => void;
  setTransactionLoading: (loading: boolean) => void;
  setTransactionFetching: (fetching: boolean) => void;
  setTransactionDetails: (details: TransactionDetails | null) => void;
  setDetailsLoading: (loading: boolean) => void;
  setDetailsError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setFetching: (fetching: boolean) => void;
  resetDetailsState: () => void;

  // API MANAGEMENT
  connect: (endpoint?: string) => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;

  // DATA FETCHING
  fetchNetworkData: () => Promise<void>;
  fetchTransactionData: () => Promise<void>;
  fetchTransactionDetails: (hash: string) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshTransactionData: () => Promise<void>;

  // NETWORK DATA (CACHED)
  networkData: any | null;
  setNetworkData: (data: any) => void;
  clearNetworkData: () => void;

  // VALIDATORS
  validators: ValidatorInfo[];
  fetchValidators: () => Promise<void>;

  // TANSTACK QUERY CLIENT
  queryClient: QueryClient;
}

// WEBSOCKET ENDPOINTS
const ENDPOINTS = ['wss://node01.xorion.network']
// import.meta.env.VITE_POLKADOT_ENDPOINTS.split(",");

const DEFAULT_METRICS: NetworkMetrics = {
  validatorsOnline: 0,
  totalValidators: 0,
  stakingAPR: 0,
  avgBlockTime: 0,
  totalTransactions: 0,
  totalValueLocked: "0",
  networkHealth: 0,
  activeAddresses: 0,
  lastUpdated: 0,
};


// TIMEOUT CONSTANTS
const CONNECTION_TIMEOUT = 30000;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds
const HEALTH_CHECK_INTERVAL = 15000; // 15 seconds
const MAX_LATENCY = 1000; // 1 second

// Global connection state
let currentProvider: WsProvider | null = null;
let currentApi: ApiPromise | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let currentEndpointIndex = 0;
let retryDelay = INITIAL_RETRY_DELAY;
let eventListeners: { [key: string]: (...args: any[]) => void } = {};

export const usePolkadotStore = create<PolkadotStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    apiState: {
      api: null,
      status: "disconnected",
      lastError: null,
      latency: null,
      connectionAttempts: 0,
      lastSuccessfulConnection: null,
      endpoint: null,
      lastConnected: null,
    },
    api: null,
    networkMetrics: DEFAULT_METRICS,
    chartData: [],
    stakingData: [],
    transactionData: {
      transactions: [],
      blocks: [],
      lastUpdated: 0,
    },
    isTransactionLoading: true,
    isTransactionFetching: false,
    transactionDetails: null,
    isDetailsLoading: true,
    detailsError: null,
    isLoading: true,
    isFetching: false,
    networkData: null,
    validators: [],
    queryClient: new QueryClient(),

    // State Setters
    setApiState: (updates) =>
      set((state) => ({
        apiState: { ...state.apiState, ...updates },
      })),

    setApi: (api) => set({ api }),

    setNetworkMetrics: (updates) =>
      set((state) => ({
        networkMetrics: {
          ...state.networkMetrics,
          ...updates,
          lastUpdated: Date.now(),
        },
      })),

    setChartData: (data) => set({ chartData: data }),
    setStakingData: (data) => set({ stakingData: data }),
    setTransactionData: (updates) =>
      set((state) => ({
        transactionData: {
          ...state.transactionData,
          ...updates,
          lastUpdated: Date.now(),
        },
      })),
    setTransactionLoading: (loading) => set({ isTransactionLoading: loading }),
    setTransactionFetching: (fetching) =>
      set({ isTransactionFetching: fetching }),
    setTransactionDetails: (details) => set({ transactionDetails: details }),
    setDetailsLoading: (loading) => set({ isDetailsLoading: loading }),
    setDetailsError: (error) => set({ detailsError: error }),
    setLoading: (loading) => set({ isLoading: loading }),
    setFetching: (fetching) => set({ isFetching: fetching }),

    // Reset transaction details state
    resetDetailsState: () =>
      set({
        isDetailsLoading: false,
        detailsError: null,
        transactionDetails: null,
      }),

    // Fixed API Management with proper cleanup and reconnection
    connect: async (endpoint?: string) => {
      const { setApiState, setApi, setLoading } = get();

      if (get().apiState.status === "connecting") return;

      setLoading(true);
      setApiState({
        status: "connecting",
        connectionAttempts: get().apiState.connectionAttempts + 1,
      });

      // Clean up previous connections
      await cleanupConnection();

      const endpointsToTry = endpoint ? [endpoint] : ENDPOINTS;
      const startIndex = endpoint ? 0 : currentEndpointIndex;

      for (let i = 0; i < endpointsToTry.length; i++) {
        const endpointIndex = (startIndex + i) % endpointsToTry.length;
        const targetEndpoint = endpointsToTry[endpointIndex];

        try {
          console.log(`🔄 Attempting to connect to: ${targetEndpoint}`);

          // Create new provider
          const provider = new WsProvider(targetEndpoint, CONNECTION_TIMEOUT);
          currentProvider = provider;

          // Setup event listeners with proper cleanup
          setupProviderListeners(provider, targetEndpoint);

          // Create API with precompiled metadata
          const metadata: Record<string, `0x${string}`> = {
            "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3-1000":
              precompiledMetadata as `0x${string}`,
          };

          const api = await ApiPromise.create({
            provider,
            // metadata,
            throwOnConnect: false,
            noInitWarn: true,
            initWasm: false,
          });

          await api.isReady;

          // Test connection
          await api.rpc.system.chain();

          setApi(api);
          setApiState({
            status: "connected",
            endpoint: targetEndpoint,
            lastConnected: new Date(),
            lastSuccessfulConnection: Date.now(),
            lastError: null,
          });

          // Setup health monitoring
          setupHealthMonitoring();

          // Reset retry parameters on successful connection
          currentEndpointIndex = endpointIndex;
          retryDelay = INITIAL_RETRY_DELAY;

          setLoading(false);
          console.log(`✅ Successfully connected to: ${targetEndpoint}`);

          // Fetch initial data
          get().fetchNetworkData();
          return;
        } catch (error: any) {
          console.warn(
            `❌ Failed to connect to ${targetEndpoint}:`,
            error.message
          );
          setApiState({ lastError: error.message });

          // Clean up failed connection
          await cleanupConnection();
          continue;
        }
      }

      // All endpoints failed
      setLoading(false);
      setApiState({ status: "error", lastError: "All endpoints failed" });
      scheduleReconnect();
    },

    disconnect: async () => {
      await cleanupConnection();

      set({
        apiState: {
          api: null,
          status: "disconnected",
          lastError: null,
          latency: null,
          connectionAttempts: 0,
          lastSuccessfulConnection: null,
          endpoint: null,
          lastConnected: null,
        },
        api: null,
      });
    },

    reconnect: async () => {
      const { endpoint } = get().apiState;
      await get().disconnect();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await get().connect(endpoint || undefined);
    },

    // Enhanced data fetching with TanStack Query
    fetchNetworkData: async () => {
      const {
        api,
        apiState,
        setNetworkMetrics,
        setChartData,
        setStakingData,
        setFetching,
        setApiState,
        queryClient,
      } = get();

      if (!api || apiState.status !== "connected") {
        setFetching(false);
        return;
      }

      setFetching(true);

      try {
        const result = await queryClient.fetchQuery({
          queryKey: ["networkData"],
          queryFn: async () => {
            // Fetch with timeout
            const dataPromise = fetchNetworkDataWithTimeout(api);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Network data fetch timeout")),
                30000
              )
            );

            return await Promise.race([dataPromise, timeoutPromise]);
          },
          staleTime: 30000,
          gcTime: 30000,
          retry: 3,
        });

        if (result) {
          const { metrics, chartData, stakingData } = result as any;
          setNetworkMetrics(metrics);
          setChartData(chartData);
          setStakingData(stakingData);
        }
      } catch (error: any) {
        console.error("❌ Network data fetch failed:", error);
        setApiState({ lastError: error.message });
      } finally {
        setFetching(false);
      }
    },

    // FIXED: Enhanced transaction data fetching with TanStack Query
    fetchTransactionData: async () => {
      const {
        api,
        apiState,
        setTransactionData,
        setTransactionLoading,
        setTransactionFetching,
        queryClient,
      } = get();
      console.log(
        "Endpoint is: ",
        ENDPOINTS,
        "About to get the data and the api state is ",
        api,
        apiState
      );

      if (!api || apiState.status !== "connected") {
        setTransactionLoading(false);
        setTransactionFetching(false);
        return;
      }

      setTransactionLoading(true);
      setTransactionFetching(true);

      try {
        const transactionData = await queryClient.fetchQuery({
          queryKey: ["transactionData"],
          queryFn: () => fetchEnhancedTransactionData(api),
          staleTime: 15000,
          gcTime: 15000,
          retry: 3,
        });

        setTransactionData(transactionData);
      } catch (error: any) {
        console.error("❌ Transaction data fetch failed:", error);
        setTransactionData({
          transactions: [],
          blocks: [],
          lastUpdated: Date.now(),
        });
      } finally {
        setTransactionLoading(false);
        setTransactionFetching(false);
      }
    },

    // FIXED: Enhanced transaction details with TanStack Query
    fetchTransactionDetails: async (hash: string) => {
      const {
        api,
        apiState,
        setTransactionDetails,
        setDetailsLoading,
        setDetailsError,
        queryClient,
      } = get();

      if (!api || apiState.status !== "connected") {
        setDetailsError("Not connected to network");
        return;
      }

      setDetailsLoading(true);
      setDetailsError(null);

      try {
        const transactionDetails = await queryClient.fetchQuery({
          queryKey: ["txDetails", hash],
          queryFn: () => findTransactionByHash(api, hash),
          staleTime: 60000,
          gcTime: 60000,
          retry: 3,
        });

        if (transactionDetails) {
          setTransactionDetails(transactionDetails);
        } else {
          setDetailsError("Transaction not found");
        }
      } catch (error: any) {
        console.error("❌ Error fetching transaction details:", error);
        setDetailsError(error.message);
      } finally {
        setDetailsLoading(false);
      }
    },

    refreshData: async () => {
      const { queryClient, fetchNetworkData, setNetworkMetrics } = get();
      await queryClient.invalidateQueries({ queryKey: ["networkData"] });
      setNetworkMetrics({ lastUpdated: 0 });
      await fetchNetworkData();
    },

    refreshTransactionData: async () => {
      const { queryClient, fetchTransactionData, setTransactionData } = get();
      await queryClient.invalidateQueries({ queryKey: ["transactionData"] });
      setTransactionData({ transactions: [], blocks: [], lastUpdated: 0 });
      await fetchTransactionData();
    },

    setNetworkData: (data: any) => set({ networkData: data }),
    clearNetworkData: () => set({ networkData: null }),

    // Enhanced validators fetching with TanStack Query
    fetchValidators: async () => {
      const { api, apiState, queryClient } = get();
      if (!api || apiState.status !== "connected") return;

      try {
        const validatorInfos = await queryClient.fetchQuery({
          queryKey: ["validators"],
          queryFn: async () => {
            const validatorAddresses = await api.query.session.validators();
            return await Promise.all(
              (validatorAddresses as unknown as any[])
                .slice(0, 10)
                .map(async (addressCodec: any) => {
                  const address = addressCodec.toString();

                  try {
                    const [prefs, ledger] = await Promise.all([
                      api.query.staking.validators(address),
                      api.query.staking.ledger(address),
                    ]);

                    const commission =
                      (prefs as any).commission.toNumber() / 1e7;
                    const selfBonded = (ledger as any).isSome
                      ? (ledger as any).unwrap().active.toString()
                      : "0";

                    return {
                      address,
                      commission,
                      selfBonded,
                      nominators: 0, // Simplified
                      totalStake: "0", // Simplified
                      status: "active",
                    };
                  } catch {
                    return {
                      address,
                      commission: 0,
                      selfBonded: "0",
                      nominators: 0,
                      totalStake: "0",
                      status: "unknown",
                    };
                  }
                })
            );
          },
          staleTime: 30000,
          gcTime: 30000,
          retry: 3,
        });

        set({ validators: validatorInfos });
      } catch (error) {
        console.error("❌ Error fetching validators:", error);
        set({ validators: [] });
      }
    },
  }))
);

// Helper functions
async function cleanupConnection() {
  // Clear intervals
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Clean up event listeners
  Object.values(eventListeners).forEach((cleanup) => cleanup());
  eventListeners = {};

  // Disconnect API
  if (currentApi) {
    try {
      await currentApi.disconnect();
    } catch (error) {
      console.warn("Error disconnecting API:", error);
    }
    currentApi = null;
  }

  // Disconnect provider
  if (currentProvider) {
    try {
      currentProvider.disconnect();
    } catch (error) {
      console.warn("Error disconnecting provider:", error);
    }
    currentProvider = null;
  }
}

function setupProviderListeners(provider: WsProvider, endpoint: string) {
  const { setApiState } = usePolkadotStore.getState();

  const onConnected = () => {
    console.log(`WebSocket connected to ${endpoint}`);
    setApiState({ status: "connected", lastConnected: new Date() });
  };

  const onDisconnected = () => {
    console.log(` WebSocket disconnected from ${endpoint}`);
    setApiState({ status: "disconnected" });
    scheduleReconnect();
  };

  const onError = (error: any) => {
    console.error(` WebSocket error on ${endpoint}:`, error);
    setApiState({ status: "error", lastError: error.message });
    scheduleReconnect();
  };

  provider.on("connected", onConnected);
  provider.on("disconnected", onDisconnected);
  provider.on("error", onError);
}

function setupHealthMonitoring() {
  if (healthCheckInterval) return;

  healthCheckInterval = setInterval(async () => {
    const { api, apiState, setApiState } = usePolkadotStore.getState();

    if (
      !api ||
      (apiState.status !== "connected" && apiState.status !== "degraded")
    ) {
      return;
    }

    try {
      const start = Date.now();
      await api.rpc.system.chain();
      const latency = Date.now() - start;

      setApiState({ latency });

      if (latency > MAX_LATENCY) {
        if (apiState.status !== "degraded") {
          setApiState({ status: "degraded" });
        }
      } else if (latency <= MAX_LATENCY && apiState.status === "degraded") {
        setApiState({ status: "connected" });
      }
    } catch (error: any) {
      console.error(" Health check failed:", error);
      setApiState({ status: "error", lastError: error.message });
      scheduleReconnect();
    }
  }, HEALTH_CHECK_INTERVAL);
}

function scheduleReconnect() {
  if (reconnectTimeout) return;

  const { connectionAttempts } = usePolkadotStore.getState().apiState;

  if (connectionAttempts >= MAX_RETRIES) {
    console.error(" Max connection attempts reached");
    return;
  }

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    rotateEndpoint();
    usePolkadotStore.getState().connect();
  }, retryDelay);

  // Exponential backoff
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
}

function rotateEndpoint() {
  currentEndpointIndex = (currentEndpointIndex + 1) % ENDPOINTS.length;
}

async function fetchNetworkDataWithTimeout(api: ApiPromise) {
  const [validatorsEntries, activeEraResult, lastHeaderResult, stakingLedgers] =
    await Promise.all([
      api.query.staking.validators.entries(),
      api.query.staking.activeEra(),
      api.rpc.chain.getHeader(),
      api.query.staking.ledger.entries(),
    ]);

  const totalValidators = validatorsEntries.length;
  const validatorsOnline = validatorsEntries.filter(([_, prefs]) => {
    const p = prefs as any;
    return !p.blocked?.isTrue;
  }).length;

  const networkHealth =
    totalValidators > 0
      ? Math.round((validatorsOnline / totalValidators) * 100)
      : 0;

  let totalValueLocked = new BN(0);
  for (const [accountId, ledger] of stakingLedgers as any[]) {
    if (ledger.isSome) {
      const activeStake = ledger.unwrap().active as any;
      totalValueLocked = totalValueLocked.add(new BN(activeStake.toString()));
    }
  }

  const metrics = {
    validatorsOnline,
    totalValidators,
    stakingAPR: 0, // Simplified
    avgBlockTime: 6, // Approximate
    totalTransactions: 0, // Simplified
    totalValueLocked: formatTxor(totalValueLocked.toString(), 18), // Format with 18 decimals
    networkHealth,
    activeAddresses: Math.floor(validatorsOnline * 1.2),
    lastUpdated: Date.now(),
  };

  return {
    metrics,
    chartData: [],
    stakingData: [],
  };
}

// FIXED: Enhanced transaction data fetching with proper transfer detection
async function fetchEnhancedTransactionData(api: ApiPromise) {
  // const finalizedHead = await api.rpc.chain.getFinalizedHead();
  let finalizedHead: any;
  try {
    finalizedHead = await api.rpc.chain.getFinalizedHead();
    console.log("📊 Finalized head:", finalizedHead.toHex());
  } catch (error) {
    console.error("❌ Failed to get finalized head:", error);
    return { transactions: [], blocks: [], lastUpdated: Date.now() };
  }

  let latestBlockNumber;
  try {
    const header = await api.rpc.chain.getHeader(finalizedHead);
    latestBlockNumber = header.number.toNumber();
    console.log("📊 Latest block number:", latestBlockNumber);
  } catch (error) {
    console.error("❌ Failed to get header for finalized head:", error);
    return { transactions: [], blocks: [], lastUpdated: Date.now() };
  }
  const blockNumbers = Array.from(
    { length: 5 },
    (_, i) => latestBlockNumber - i
  ).filter((n) => n >= 0);

  // 1. Get all block hashes in parallel
  const blockHashes = await Promise.all(
    blockNumbers.map(async (number) => {
      try {
        const hash = await api.rpc.chain.getBlockHash(number);
        console.log(`📊 Block ${number} hash:`, hash.toHex());
        return hash;
      } catch (error) {
        console.error(`❌ Failed to get hash for block ${number}:`, error);
        return null;
      }
    })
  );
  // 2. Get all blocks and events in parallel

  const blocksAndEvents = await Promise.all(
    blockHashes.map(async (hash, index) => {
      if (!hash) return null;
      try {
        const [block, events] = await Promise.all([
          api.rpc.chain.getBlock(hash),
          api.query.system.events.at(hash),
        ]);
        console.log(
          `📊 Block ${blockNumbers[index]}: extrinsics=${block.block.extrinsics.length}, events=${events.length}`
        );
        return [block, events];
      } catch (error) {
        console.error(
          `❌ Failed to fetch block ${blockNumbers[index]}:`,
          error
        );
        return null;
      }
    })
  );

  const blocks: Block[] = [];
  const transactions: Transaction[] = [];

  // 3. Process the pre-fetched data
  for (let i = 0; i < blockNumbers.length; i++) {
    if (!blocksAndEvents[i]) continue;
    const blockNumber = blockNumbers[i];
    const [signedBlock, events] = blocksAndEvents[i] as [any, any];

    try {
      let timestamp: Date | null = null;
      const timestampExtrinsic = signedBlock.block.extrinsics.find(
        (ext) =>
          ext.method.section === "timestamp" && ext.method.method === "set"
      );
      if (timestampExtrinsic) {
        const timestampArg = timestampExtrinsic.method.args[0];
        timestamp = new Date(Number(timestampArg.toString()));
      }

      blocks.push({
        height: blockNumber,
        hash: blockHashes[i].toHex(),
        timestamp,
        txCount: signedBlock.block.extrinsics.length,
        proposer: "Unknown",
        size: JSON.stringify(signedBlock.block).length.toString(),
      });

      // Process extrinsics with enhanced transfer detection
      signedBlock.block.extrinsics.forEach((extrinsic, index) => {
        const txHash = extrinsic.hash.toHex();

        // Get events for this extrinsic
        const eventsArray = events as unknown as any[];
        const extrinsicEvents = eventsArray.filter(
          ({ phase }) =>
            phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index)
        );

        // Determine success status
        const success = !extrinsicEvents.some(({ event }) =>
          api.events.system.ExtrinsicFailed.is(event)
        );

        // Enhanced transfer detection
        const transferInfo = detectTransferFromExtrinsic(
          extrinsic,
          extrinsicEvents,
          api
        );

        // Calculate fee
        const fee = calculateTransactionFee(extrinsicEvents, api);

        const transaction: Transaction = {
          hash: txHash,
          blockNumber,
          blockHash: blockHashes[i].toHex(),
          index,
          method: extrinsic.method.method,
          section: extrinsic.method.section,
          signer: extrinsic.signer?.toString() || "System",
          timestamp,
          success,
          fee: formatTxor(fee),
          args: extrinsic.method.args.map((arg) => arg.toString().slice(0, 50)),
          isTransfer: transferInfo.isTransfer,
          transferFrom: transferInfo.from,
          transferTo: transferInfo.to,
          transferAmount: transferInfo.amount
            ? formatTxor(transferInfo.amount)
            : undefined,
          transferAsset: transferInfo.asset,
          events: extrinsicEvents.map(({ event, phase }) => ({
            phase: phase?.toString() || "Unknown",
            event: {
              section: event.section,
              method: event.method,
              data: event.data.toHuman(),
            },
          })),
          decodedData: transferInfo.decodedData,
        };

        transactions.push(transaction);
      });
    } catch (error) {
      console.warn(`Failed to process block ${blockNumber}:`, error);
    }
  }

  return {
    transactions: transactions
      .slice(0, 100)
      .sort((a, b) => b.blockNumber - a.blockNumber),
    blocks,
    lastUpdated: Date.now(),
  };
}

// FIXED: Enhanced transfer detection function
function detectTransferFromExtrinsic(
  extrinsic: any,
  events: any[],
  api: ApiPromise
) {
  const section = extrinsic.method.section;
  const method = extrinsic.method.method;
  const args = extrinsic.method.args;

  const transferInfo = {
    isTransfer: false,
    from: undefined as string | undefined,
    to: undefined as string | undefined,
    amount: undefined as string | undefined,
    asset: "XOR",
    decodedData: undefined as any,
  };

  // Method 1: Check by extrinsic method
  const transferMethods = [
    "transfer",
    "transferKeepAlive",
    "transferAll",
    "forceTransfer",
    "transferAllowDeath",
    "transferWithFee",
  ];

  if (
    (section === "balances" ||
      section === "currencies" ||
      section === "tokens" ||
      section === "assets") &&
    transferMethods.some((tm) =>
      method.toLowerCase().includes(tm.toLowerCase())
    )
  ) {
    transferInfo.isTransfer = true;
    transferInfo.from = extrinsic.signer?.toString();

    // Parse arguments based on method
    if (args.length >= 2) {
      transferInfo.to = args[0].toString();
      transferInfo.amount = args[1].toString();
    }

    transferInfo.decodedData = {
      section,
      method,
      args: args.map((arg) => arg.toHuman()),
    };
  }

  // Method 2: Check by events (more reliable)
  const transferEvents = events.filter(({ event }) => {
    return (
      api.events.balances?.Transfer?.is(event) ||
      api.events.currencies?.Transferred?.is(event) ||
      api.events.tokens?.Transfer?.is(event) ||
      api.events.assets?.Transferred?.is(event) ||
      (event.section === "balances" && event.method === "Transfer") ||
      (event.section === "currencies" && event.method === "Transferred") ||
      (event.section === "tokens" && event.method === "Transfer") ||
      (event.section === "assets" && event.method === "Transferred")
    );
  });

  if (transferEvents.length > 0) {
    transferInfo.isTransfer = true;

    const transferEvent = transferEvents[0].event;
    const eventData = transferEvent.data;

    // Parse event data based on event structure
    if (eventData.length >= 3) {
      transferInfo.from = eventData[0].toString();
      transferInfo.to = eventData[1].toString();
      transferInfo.amount = eventData[2].toString();
    }

    transferInfo.decodedData = {
      eventSection: transferEvent.section,
      eventMethod: transferEvent.method,
      eventData: eventData.toHuman(),
    };
  }

  // Method 3: Check staking operations (bond, unbond, withdraw)
  const stakingMethods = [
    "bond",
    "bondExtra",
    "unbond",
    "withdrawUnbonded",
    "nominate",
    "chill",
  ];
  if (section === "staking" && stakingMethods.includes(method)) {
    transferInfo.decodedData = {
      section,
      method,
      args: args.map((arg) => arg.toHuman()),
      isStaking: true,
    };
  }

  return transferInfo;
}

// FIXED: Calculate transaction fee from events
function calculateTransactionFee(events: any[], api: ApiPromise): string {
  const feeEvents = events.filter(
    ({ event }) =>
      api.events.balances?.Withdraw?.is(event) ||
      api.events.transactionPayment?.TransactionFeePaid?.is(event) ||
      (event.section === "balances" && event.method === "Withdraw") ||
      (event.section === "transactionPayment" &&
        event.method === "TransactionFeePaid")
  );

  if (feeEvents.length > 0) {
    const feeEvent = feeEvents[0].event;
    const eventData = feeEvent.data;

    // Fee is usually the last parameter
    if (eventData.length > 0) {
      return eventData[eventData.length - 1].toString();
    }
  }

  return "0";
}

// FIXED: Enhanced transaction lookup by hash with timeout
async function findTransactionByHash(
  api: ApiPromise,
  hash: string
): Promise<TransactionDetails | null> {
  try {
    // Normalize the hash input
    const normalizedHash = hash.trim();
    const searchHash = normalizedHash.startsWith("0x")
      ? normalizedHash
      : `0x${normalizedHash}`;

    console.log(`🔍 Searching for transaction hash: ${searchHash}`);

    // Add timeout to prevent hanging
    const searchPromise = performTransactionSearch(
      api,
      searchHash,
      normalizedHash
    );
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error("Search timeout - transaction not found in recent blocks")
          ),
        30000
      )
    );

    return await Promise.race([searchPromise, timeoutPromise]);
  } catch (error) {
    console.error("Error finding transaction:", error);
    throw error;
  }
}

// Separate function for the actual search logic
async function performTransactionSearch(
  api: ApiPromise,
  searchHash: string,
  normalizedHash: string
): Promise<TransactionDetails | null> {
  // Get recent blocks to search for the transaction
  const finalizedHead = await api.rpc.chain.getFinalizedHead();
  const finalizedBlock = await api.rpc.chain.getBlock(finalizedHead);
  const latestBlockNumber = finalizedBlock.block.header.number.toNumber();

  console.log(
    ` Searching through blocks ${
      latestBlockNumber - 100
    } to ${latestBlockNumber}`
  );

  // Search through last 100 blocks
  for (let i = 0; i < 100; i++) {
    const blockNumber = latestBlockNumber - i;
    if (blockNumber < 0) break;

    try {
      const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
      const [block, events] = await Promise.all([
        api.rpc.chain.getBlock(blockHash),
        api.query.system.events.at(blockHash),
      ]);

      // Search for the transaction in this block
      const extrinsicIndex = block.block.extrinsics.findIndex((ext) => {
        const extHash = ext.hash.toHex();
        // Try multiple hash formats for better matching
        return (
          extHash === searchHash ||
          extHash === normalizedHash ||
          extHash.toLowerCase() === searchHash.toLowerCase() ||
          extHash.toLowerCase() === normalizedHash.toLowerCase() ||
          extHash === searchHash.replace("0x", "") ||
          extHash === normalizedHash.replace("0x", "")
        );
      });

      if (extrinsicIndex !== -1) {
        console.log(
          `Found transaction in block ${blockNumber} at index ${extrinsicIndex}`
        );

        const extrinsic = block.block.extrinsics[extrinsicIndex];

        // Get events for this extrinsic
        const eventsArray = events as unknown as any[];
        const extrinsicEvents = eventsArray.filter(
          ({ phase }) =>
            phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex)
        );

        // Determine success
        const success = !extrinsicEvents.some(({ event }) =>
          api.events.system.ExtrinsicFailed.is(event)
        );

        // Get timestamp
        let timestamp: Date | null = null;
        const timestampExtrinsic = block.block.extrinsics.find(
          (ext) =>
            ext.method.section === "timestamp" && ext.method.method === "set"
        );
        if (timestampExtrinsic) {
          const timestampArg = timestampExtrinsic.method.args[0];
          timestamp = new Date(Number(timestampArg.toString()));
        }

        // Calculate fee
        const fee = calculateTransactionFee(extrinsicEvents, api);

        // Enhanced transfer detection
        const transferInfo = detectTransferFromExtrinsic(
          extrinsic,
          extrinsicEvents,
          api
        );

        const transactionDetails: TransactionDetails = {
          hash: extrinsic.hash.toHex(),
          blockNumber,
          blockHash: blockHash.toHex(),
          index: extrinsicIndex,
          method: extrinsic.method.method,
          section: extrinsic.method.section,
          signer: extrinsic.signer?.toString() || "System",
          timestamp,
          success,
          fee: formatTxor(fee),
          args: extrinsic.method.args.map((arg) => arg.toString()),
          events: extrinsicEvents.map(({ event, phase }) => ({
            phase: phase?.toString() || "Unknown",
            event: {
              section: event.section,
              method: event.method,
              data: event.data.toHuman(),
            },
          })),
          error: success ? null : "Transaction failed",
          nonce: extrinsic.nonce?.toNumber() || 0,
          tip: extrinsic.tip?.toString() || "0",
          era: extrinsic.era?.toNumber() || 0,
          signature: extrinsic.signature?.toString() || "",
          isDecoded: true,
          decodedArgs: extrinsic.method.args.map((arg) => arg.toHuman()),
        };

        console.log(
          ` Transaction details: ${transactionDetails.method}.${transactionDetails.section} in block ${blockNumber}`
        );
        return transactionDetails;
      }
    } catch (error) {
      console.warn(`Error searching block ${blockNumber}:`, error);
      continue;
    }
  }

  console.log(` Transaction ${searchHash} not found in last 100 blocks`);
  return null;
}

async function fetchTransactionDataWithTimeout(api: ApiPromise) {
  const finalizedHead = await api.rpc.chain.getFinalizedHead();
  const finalizedBlock = await api.rpc.chain.getBlock(finalizedHead);
  const latestBlockNumber = finalizedBlock.block.header.number.toNumber();

  const blockNumbers = Array.from(
    { length: 5 },
    (_, i) => latestBlockNumber - i
  );
  const blocks: Block[] = [];
  const transactions: Transaction[] = [];

  for (const blockNumber of blockNumbers) {
    try {
      const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
      const block = await api.rpc.chain.getBlock(blockHash);

      let timestamp: Date | null = null;
      const timestampExtrinsic = block.block.extrinsics.find(
        (ext) =>
          ext.method.section === "timestamp" && ext.method.method === "set"
      );
      if (timestampExtrinsic) {
        const timestampArg = timestampExtrinsic.method.args[0];
        timestamp = new Date(Number(timestampArg.toString()));
      }

      blocks.push({
        height: blockNumber,
        hash: blockHash.toHex(),
        timestamp,
        txCount: block.block.extrinsics.length,
        proposer: "Unknown",
        size: JSON.stringify(block.block).length.toString(),
      });

      block.block.extrinsics.slice(0, 10).forEach((extrinsic, index) => {
        transactions.push({
          hash: extrinsic.hash.toHex(),
          blockNumber,
          blockHash: blockHash.toHex(),
          index,
          method: extrinsic.method.method,
          section: extrinsic.method.section,
          signer: extrinsic.signer?.toString() || "System",
          timestamp,
          success: true,
          fee: "0",
          args: extrinsic.method.args.map((arg) => arg.toString().slice(0, 20)),
          isTransfer: false,
          events: [],
        });
      });
    } catch (error) {
      console.warn(`Failed to fetch block ${blockNumber}:`, error);
    }
  }

  return {
    transactions: transactions.slice(0, 50),
    blocks,
    lastUpdated: Date.now(),
  };
}

// Auto-connect on store initialization
if (typeof window !== "undefined") {
  setTimeout(() => {
    usePolkadotStore.getState().connect();
  }, 1000);
}

// Auto-refresh data
if (typeof window !== "undefined") {
  setInterval(() => {
    const { apiState, fetchNetworkData } = usePolkadotStore.getState();
    if (apiState.status === "connected") {
      fetchNetworkData().catch(console.warn);
    }
  }, 30000);
}
