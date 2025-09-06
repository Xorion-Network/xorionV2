import { useState, useEffect, useMemo } from "react";
import { web3FromSource } from "@polkadot/extension-dapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useWallet } from "./WalletConnection";
import { usePolkadot } from "@/hooks/use-polkadot";
import { useToast } from "@/components/ui/use-toast";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnect,
  useBalance 
} from "wagmi";
import { parseUnits } from "viem";
import BRIDGE_ABI from "@/lib/bridge-abi.json";
import BRIDGE_ABI_BSC from "@/lib/bridge-abibsc.json";
import {ensureEthereumNetwork, ensureBSCNetwork} from "@/lib/utils";
import { decodeAddress } from "@polkadot/util-crypto";
import { http, createConfig } from "wagmi";
import { mainnet, bsc } from "wagmi/chains";
import { switchChain, estimateGas } from "wagmi/actions";

const TOKEN_DECIMALS = 18;

//Ethereum config
// const BRIDGE_CONTRACT_ADDRESS = "0xa21f5388f3b812D0C2ab97A6C04f40576B961eb3";
// const XWOR_CONTRACT_ADDRESS = '0xa21f5388f3b812D0C2ab97A6C04f40576B961eb3'
// const ETH_CHAIN = mainnet;
// // eslint-disable-next-line no-constant-binary-expression
// const ETH_RPC = import.meta.env.VITE_ETH_RPC || 
//                 "https://eth.merkle.io" || 
//                 "https://eth.llamarpc.com" || 
//                 "https://rpc.ankr.com/eth";


// Ethereum config 
// export const wagmiConfig = createConfig({
//   chains: [ETH_CHAIN],
//   transports: {
//     [ETH_CHAIN.id]: http(ETH_RPC),
//   },
// });

const BSC_CHAIN = bsc;
const BSC_RPC = import.meta.env.VITE_BSC_RPC || "https://bsc-dataseed.binance.org"
const BRIDGE_CONTRACT_ADDRESS = "0x0a400F719b4BA637D5632649cb73684171348054"
const BSC_TOKEN_CONTRACT = "0x0a400F719b4BA637D5632649cb73684171348054"
//bsc config
export const wagmiConfig = createConfig({
  chains: [BSC_CHAIN],
  transports: {
    [BSC_CHAIN.id]: http(BSC_RPC),
  },
});


const BridgeLockForm = ({
  onSearchTransaction,
}: {
  onSearchTransaction: (blockHash: string) => void;
}) => {
  const { api, isConnected, isConnecting, forceReconnect, status } =
    usePolkadot();
  const { selectedAccount,balance } = useWallet();
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [relayerFee, setRelayerFee] = useState<string>("");
  const [ethRecipient, setEthRecipient] = useState<string>("");
  const [releaseAmount, setReleaseAmount] = useState<string>("");
  const [xorionRecipient, setXorionRecipient] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"bridge" | "release">("bridge");

  const { address: ethAddress, isConnected: isEthConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const {
    writeContract,
    data: txHash,
    isPending: isEthPending,
    error: ethError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isEthSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const toChainUnits = (value: string): bigint => {
    try {
      const num = Number(value);
      if (isNaN(num) || num < 0) throw new Error("Invalid amount");
      return parseUnits(value, TOKEN_DECIMALS);
    } catch {
      throw new Error("Invalid amount format");
    }
  };

  useEffect(() => {
  const debugMetaMaskState = async () => {
    if (typeof window.ethereum !== 'undefined') {
      // Check current chain
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log('MetaMask current chainId:', chainId);
      
      // Check all configured chains in MetaMask
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      console.log('Connected accounts:', accounts);
      
      // Check if Taker is configured in MetaMask
      console.log('MetaMask _state:', window.ethereum._state);
    }
  };
  
  debugMetaMaskState();
}, []);

  // Check what these values are
// console.log('ETH_CHAIN:', ETH_CHAIN);
// console.log('ETH_RPC:', ETH_RPC);

  const toMessageId = (hex: string): Uint8Array => {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (cleanHex.length !== 64)
      throw new Error("Message ID must be 32 bytes (64 hex chars)");
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  };

  const toSignatures = (sigInput: string): Uint8Array[] => {
    const sigs = sigInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    return sigs.map((sig) => {
      const cleanSig = sig.startsWith("0x") ? sig.slice(2) : sig;
      if (cleanSig.length !== 130)
        throw new Error("Each signature must be 65 bytes (130 hex chars)");
      const bytes = new Uint8Array(65);
      for (let i = 0; i < 65; i++) {
        bytes[i] = parseInt(cleanSig.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    });
  };

  const generateNonce = (): number => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return Number(`${timestamp}${random}`.slice(0, 10));
  };

  const bridgeTokens = async () => {
    if (!api || !selectedAccount || !amount || !relayerFee || !ethRecipient) {
      setError("Please fill in all fields and connect a Polkadot wallet.");
      return;
    }

    if (!ethRecipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Invalid Ethereum recipient address.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.isReady;

      if (!api.tx.ethereumBridge) {
        throw new Error("ethereumBridge pallet not found in api.tx");
      }

      const {
        address,
        meta: { source },
      } = selectedAccount;
      const injector = await web3FromSource(source);
      const nonce = generateNonce();

      const amountUnits = toChainUnits(amount);
      const relayerFeeUnits = toChainUnits(relayerFee);

      const extrinsic = api.tx.ethereumBridge.lock(
        amountUnits.toString(),
        relayerFeeUnits.toString(),
        ethRecipient,
        nonce
      );

      await extrinsic.signAndSend(
        address,
        { signer: injector.signer },
        ({ status, events }) => {
          if (status.isInBlock) {
            setSuccess(`Transaction included in block: ${status.asInBlock}`);
          } else if (status.isFinalized) {
            let messageId = "";
            events.forEach(({ event: { data, method, section } }) => {
              if (section === "ethereumBridge" && method === "Locked") {
                messageId = data[5].toHex();
              }
            });
            setSuccess(`Transaction finalized! Message ID: ${messageId}`);
            toast({
              title: "Success",
              description: "Tokens successfully bridged!",
            });
            setTimeout(() => {
              onSearchTransaction(status.asInBlock.toString());
            }, 2000);
          }
        }
      );
    } catch (err) {
      setError(`Transaction failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const releaseTokens = async () => {
    if (!isEthConnected || !ethAddress || !releaseAmount || !xorionRecipient) {
      setError(
        "Please connect Ethereum wallet, fill in amount and Xorion recipient."
      );
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      await switchChain(wagmiConfig, { chainId: BSC_CHAIN.id });

      // await ensureEthereumNetwork();
      await ensureBSCNetwork();

      // Validate SS58 address
      if (!xorionRecipient.match(/^[1-9A-HJ-NP-Za-km-z]{46,48}$/)) {
        throw new Error("Invalid Xorion (Polkadot) recipient address.");
      }

      const decodedRecipient = decodeAddress(xorionRecipient);
      const recipientBytes = `0x${Array.from(decodedRecipient)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`;

      const amountUnits = toChainUnits(releaseAmount);

      writeContract({
        address: BRIDGE_CONTRACT_ADDRESS,
        abi: BRIDGE_ABI_BSC,
        functionName: "lock",
        args: [amountUnits, recipientBytes],
        chain: BSC_CHAIN, // ETH_CHAIN,
        account: ethAddress,
      });
    } catch (err) {
      setError(`Release failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const { data: tokenBalance, isLoading: tokenBalanceLoading } = useBalance({
  address: ethAddress,
  token: BSC_TOKEN_CONTRACT //XWOR_CONTRACT_ADDRESS, 
});

  const { data: ethBalance } = useBalance({
    address: ethAddress,
  });

  console.log('tokenBal: ', tokenBalance)
  console.log('ethBal: ', ethBalance)

  const handleConnectEthereum = () => {
     console.log('Available connectors:', connectors);
    const metaMask = connectors.find((c) => c.id === "io.metamask");
    const trustWallet = connectors.find((c) => c.id === "com.trustwallet.app");
    if (metaMask) {
      connect({ connector: metaMask });
    } else if (trustWallet){
      connect({connector: trustWallet})
    }
    else {
      // setError("MetaMask not detected. Please install it.");
      setError("Wallet not detected. Please install it.");
    }
  };

  useEffect(() => {
    if (["error", "disconnected"].includes(status)) {
      const timer = setTimeout(() => forceReconnect(), 30000);
      return () => clearTimeout(timer);
    }
  }, [status, forceReconnect]);

  useEffect(() => {
    if (ethError) {
      // setError(`Ethereum transaction failed: ${ethError.message}`);
      setError(`Transaction failed: ${ethError.message}`);
    }
    if (isEthSuccess) {
      // setSuccess(`Tokens released (burned) on Ethereum! Tx: ${txHash}`);
      setSuccess(`Tokens released (burned)! Tx: ${txHash}`);
      toast({
        title: "Success",
        description: "Tokens successfully released!",
      });
    }
  }, [ethError, isEthSuccess, txHash, toast]);


  useEffect(() => {
  console.log('Ethereum connection status:', {
    isEthConnected,
    ethAddress,
    connectors: connectors.map(c => ({id: c.id, name: c.name})),
    hasWindowEthereum: typeof window.ethereum !== 'undefined'
  });
}, [isEthConnected, ethAddress, connectors]);

// console.log('selectedAccount: ', selectedAccount)
// console.log('balance: ', balance)


// Format the balance for display
  const formattedBalance = useMemo(() => {
    if (!balance) return '0';
    return (Number(balance) / Math.pow(10, TOKEN_DECIMALS)).toFixed(4);
  }, [balance]);

  // Max button handler
  const handleMaxAmount = () => {
    if (balance && Number(balance) > 0) {
      const humanBalance = (Number(balance) / Math.pow(10, TOKEN_DECIMALS)).toString();
      setAmount(humanBalance);
    }
  };


  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Bridge Tokens to Bsc</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="break-words whitespace-normal">
              {error}
            </AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="default" className="mb-4">
            <AlertDescription className="break-words whitespace-normal">
              {success}
            </AlertDescription>
          </Alert>
        )}
        {isConnecting && (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {!isConnected && !isConnecting && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="break-words whitespace-normal">
              Blockchain node not connected. Please try again later.
            </AlertDescription>
          </Alert>
        )}
        {isConnected && !selectedAccount && activeTab === "bridge" && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="break-words whitespace-normal">
              Please connect a Polkadot wallet to proceed.
            </AlertDescription>
          </Alert>
        )}
        {activeTab === "release" && !isEthConnected && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="break-words whitespace-normal">
              Please connect a wallet (e.g., wallet on Bsc Mainnet) to
              proceed.
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          {isConnected && selectedAccount && (
            <>
              <div>
                <h3 className="font-semibold">Selected Polkadot Account:</h3>
                <p>
                  {selectedAccount.meta.name} (
                  {selectedAccount.address.slice(0, 6)}...)
                </p>
              </div>
              <div className="flex border-b">
                <button
                  className={`flex-1 py-2 px-4 text-center ${activeTab === "bridge"
                    ? "border-b-2 border-blue-500 text-blue-500"
                    : "text-gray-500"
                    }`}
                  onClick={() => setActiveTab("bridge")}
                >
                  Bridge Tokens
                </button>
                <button
                  className={`flex-1 py-2 px-4 text-center ${activeTab === "release"
                    ? "border-b-2 border-blue-500 text-blue-500"
                    : "text-gray-500"
                    }`}
                  onClick={() => setActiveTab("release")}
                >
                  Release Tokens
                </button>
              </div>
            </>
          )}
          {activeTab === "bridge" && (
            <div className="space-y-4">
               {selectedAccount && (
      <div className="flex justify-between items-center text-sm p-2 
       rounded-lg cursor-pointer text-gray-50">
        <span className="font-medium">Available Balance:</span>
        <span className="">
          {formattedBalance} tokens
        </span>
      </div>
    )}
                 <div className="relative">
      <Input
        type="number"
        placeholder="Amount to bridge (e.g., 1.5)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        step="0.000000000000000001"
        className="pr-16" // Add padding for the button
      />
      {selectedAccount && (
        <button
          type="button"
          className="absolute right-1 cursor-pointer top-1.5 h-3/4 px-5 text-xs bg-slate-300
           text-black z-10 rounded-sm"
          onClick={handleMaxAmount}
          disabled={!balance || Number(balance) <= 0}
        >
          MAX
        </button>
      )}
    </div>
              <Input
                type="number"
                placeholder="Relayer fee (e.g., 0.01)"
                value={relayerFee}
                onChange={(e) => setRelayerFee(e.target.value)}
                step="0.000000000000000001"
              />
              <Input
                placeholder="BSC recipient (0x...)"
                value={ethRecipient}
                onChange={(e) => setEthRecipient(e.target.value)}
              />
              <Button
                onClick={bridgeTokens}
                disabled={isLoading || !api || !selectedAccount || !isConnected}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Bridge Tokens
              </Button>
            </div>
          )}
          {activeTab === "release" && (
            <div className="space-y-4">
              {!isEthConnected && (
                <Button onClick={handleConnectEthereum} className="w-full">
                  Connect Wallet
                </Button>
              )}
             { isEthConnected && (
      <div className="space-y-2 p-3  text-gray-50 rounded-lg">        
        {/* Ethereum Address */}
        <div className="flex justify-between text-sm">
          <span className="">Address:</span>
          <span className="font-mono ">
            {ethAddress?.slice(0, 6)}...{ethAddress?.slice(-4)} tt
          </span>
        </div>

        {/* ETH Balance (for gas) */}
        <div className="flex justify-between text-sm">
          <span className="">BNB Balance:</span>
          <span className="font-medium ">
            {ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0'} BNB
          </span>
        </div>

        {/* Wrapped Token Balance */}
        <div className="flex justify-between text-sm">
          <span className="">Wrapped Token Balance:</span>
          <span className="font-medium ">
            {tokenBalanceLoading ? (
              // <Loader2 className="h-3 w-3 animate-spin inline" />
              '---'
            ) : tokenBalance ? (
              `${Number(tokenBalance.formatted).toFixed(4)} tokens`
            ) : (
              '0.0000 tokens'
            )}
          </span>
        </div>

        {/* Warning if no ETH for gas */}
        {ethBalance && Number(ethBalance.value) === 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">
              You need bnb for transaction fees
            </AlertDescription>
          </Alert>
        )}
      </div>
    )}

              <Input
                type="number"
                placeholder="Amount to release (e.g., 1.5)"
                value={releaseAmount}
                onChange={(e) => setReleaseAmount(e.target.value)}
                step="0.000000000000000001"
              />
              <Input
                placeholder="Xorion (Polkadot) recipient (SS58 address)"
                value={xorionRecipient}
                onChange={(e) => setXorionRecipient(e.target.value)}
              />
              <Button
                onClick={releaseTokens}
                disabled={
                  isLoading || isEthPending || isConfirming || !isEthConnected
                }
                className="w-full"
              >
                {isLoading || isEthPending || isConfirming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Release Tokens
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BridgeLockForm;
