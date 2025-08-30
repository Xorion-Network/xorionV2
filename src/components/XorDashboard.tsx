import React, { useMemo } from "react";
import { useWallet } from "@/components/WalletConnection";
import { usePolkadotStore } from "@/stores/polkadotStore";
import { useLaunchClaim } from "@/hooks/useLaunchClaim";
import { formatTxor } from "@/lib/utils";

const Card: React.FC<React.PropsWithChildren<{ title: string; action?: React.ReactNode }>> = ({ title, children, action }) => (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-1">
            <div className="text-sm text-gray-400">{title}</div>
            {action}
        </div>
        <div className="text-white text-lg">{children}</div>
    </div>
);

export default function XorDashboard() {
    const { selectedAccount, balance } = useWallet();
    const { apiState, api } = usePolkadotStore();
    const { data, isLoading, error } = useLaunchClaim();
    const [currentBlock, setCurrentBlock] = React.useState<number>(0);

    // Fetch current block number
    React.useEffect(() => {
        if (!api || apiState.status !== 'connected') return;

        const fetchBlockNumber = async () => {
            try {
                const header = await api.rpc.chain.getHeader();
                setCurrentBlock(header.number.toNumber());
            } catch (error) {
                console.error('Failed to fetch block number:', error);
            }
        };

        fetchBlockNumber();

        // Subscribe to new blocks
        const unsubscribe = api.rpc.chain.subscribeNewHeads((header) => {
            setCurrentBlock(header.number.toNumber());
        });

        return () => {
            unsubscribe.then(unsub => unsub());
        };
    }, [api, apiState.status]);

    const formattedBalance = useMemo(() => {
        if (!balance) return "0";
        return formatTxor(balance, 18, 6);
    }, [balance]);

    const totalXor = useMemo(() => formatTxor(data?.total || "0", 18, 6), [data?.total]);
    const claimedXor = useMemo(() => formatTxor(data?.claimed || "0", 18, 6), [data?.claimed]);
    const claimableCapRaw = useMemo(() => {
        try {
            const t = BigInt(data?.total || "0");
            return t / 2n; // 50% claimable at TGE
        } catch {
            return 0n;
        }
    }, [data?.total]);
    const claimableCapXor = useMemo(() => formatTxor(claimableCapRaw.toString(), 18, 6), [claimableCapRaw]);
    const availableClaimableXor = useMemo(() => {
        try {
            const c = BigInt(data?.claimed || "0");
            const available = claimableCapRaw > c ? (claimableCapRaw - c) : 0n;
            return formatTxor(available.toString(), 18, 6);
        } catch {
            return "0";
        }
    }, [data?.claimed, claimableCapRaw]);
    const tgeProgress = useMemo(() => {
        try {
            if (claimableCapRaw === 0n) return 0;
            const c = BigInt(data?.claimed || "0");
            const pct = Number((c * 10000n) / claimableCapRaw) / 100;
            return isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
        } catch {
            return 0;
        }
    }, [data?.claimed, claimableCapRaw]);

    const startBlockInfo = useMemo(() => {
        if (!data?.start || data.start === "0") return "—";
        const startBlock = Number(data.start);
        if (!isFinite(startBlock) || startBlock <= 0) return data.start;

        // Convert block number to approximate date
        // Assuming 6 seconds per block (Polkadot standard)
        const BLOCK_TIME_SECONDS = 6;
        const blocksElapsed = currentBlock - startBlock;
        const secondsElapsed = blocksElapsed * BLOCK_TIME_SECONDS;

        if (secondsElapsed < 0) {
            return `Block ${startBlock} (Future)`;
        }

        const date = new Date(Date.now() - (secondsElapsed * 1000));
        return `Block ${startBlock} (${date.toLocaleDateString()})`;
    }, [data?.start, currentBlock]);

    return (
        <div className="w-full space-y-6">
            <div className="flex items-center justify-between">
                <div className="text-white text-xl font-semibold">XOR Portfolio</div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <a
                        className="px-2 py-1 rounded-full border border-gray-600 text-gray-200 hover:bg-gray-700"
                        href="https://etherscan.io/token/0xa21f5388f3b812d0c2ab97a6c04f40576b961eb3"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Track WXOR on Ethereum
                    </a>
                    <a
                        className="px-2 py-1 rounded-full border border-gray-600 text-gray-200 hover:bg-gray-700"
                        href="https://scan.xorion.network/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Track XOR
                    </a>

                    <span>{apiState.status === 'connected' ? 'Network: Connected' : `Network: ${apiState.status}`}</span>

                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card title="Wallet Balance (XOR)">{formattedBalance}</Card>
                <Card title="TGE Total Assigned (XOR)">{isLoading ? 'Loading...' : totalXor}</Card>
                <Card title="Claimable at TGE (50%)">{isLoading ? 'Loading...' : claimableCapXor}</Card>
                <Card title="Claimed (XOR)">{isLoading ? 'Loading...' : claimedXor}</Card>
                <Card
                    title="Available to Claim Now (XOR)"
                    action={
                        <a
                            href="http://ido.xorion.network/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors whitespace-nowrap min-w-fit"
                        >
                            Buy IDO
                        </a>
                    }
                >
                    {isLoading ? 'Loading...' : availableClaimableXor}
                </Card>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-400">TGE Claim Progress (50%)</div>
                    <div className="text-sm text-white">{tgeProgress.toFixed(2)}%</div>
                </div>
                <div className="w-full h-3 bg-gray-700 rounded">
                    <div className="h-3 bg-blue-600 rounded" style={{ width: `${tgeProgress}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="text-gray-400">TGE Assigned: <span className="text-white">{totalXor} XOR</span></div>
                    <div className="text-gray-400">TGE Claimable (50%): <span className="text-white">{claimableCapXor} XOR</span></div>
                    <div className="text-gray-400">Start: <span className="text-white">{startBlockInfo}</span></div>
                </div>
                {error && <div className="mt-2 text-red-400 text-sm">{error}</div>}
            </div>

            {!selectedAccount && (
                <div className="text-sm text-yellow-400">
                    Connect your wallet to view personalized balances and vesting.
                </div>
            )}
        </div>
    );
}


