import { useState, useEffect } from "react";
import WalletConnection from './WalletConnection';
import { ApiPromise, WsProvider } from "@polkadot/api";
import { web3FromAddress } from "@polkadot/extension-dapp";
import {
  FiDroplet,
  FiRefreshCw,
  FiInfo,
  FiZap,
  FiCopy,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import { useWallet } from "./WalletConnection";
import { Link } from "react-router-dom";

// AIRDROP MANAGER CLASS
class AirdropManager {
  api;
  account;
  constructor(api, account) {
    this.api = api;
    this.account = account;
  }

  async getAirdropStats() {
    try {
      const [totalAirdrops, airdropsThisBlock, airdropAmount, maxPerBlock] =
        await Promise.all([
          this.api.query.airdrop.totalAirdrops(),
          this.api.query.airdrop.airdropsThisBlock(),
          this.api.consts.airdrop.airdropAmount,
          this.api.consts.airdrop.maxAirdropsPerBlock,
        ]);
      return {
        totalAirdrops: totalAirdrops.toString(),
        airdropsThisBlock: airdropsThisBlock.toString(),
        airdropAmount: airdropAmount.toString(),
        maxPerBlock: maxPerBlock.toString(),
      };
    } catch (e) {
      return null;
    }
  }

  async claimAirdrop() {
    const injector = await web3FromAddress(this.account.address);
    return new Promise<void>((resolve, reject) => {
      this.api.tx.airdrop
        .claimAirdrop()
        .signAndSend(
          this.account.address,
          { signer: injector.signer, nonce: -1 },
          (result) => {
            if (result.status.isInBlock) {
              let errored = false;
              result.events.forEach(({ event }) => {
                if (
                  event.section === "system" &&
                  event.method === "ExtrinsicFailed"
                )
                  errored = true;
              });
             return errored
                ? reject(
                    new Error("Failed to claim (already claimed or error)")
                  )
                : resolve();
            }
          }
        )
        .catch(reject);
    });
  }
}

export default function AirdropPanel() {
  const [api, setApi] = useState(null);
  const [manager, setManager] = useState(null);
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const { selectedAccount } = useWallet();

  const [eligible, setEligible] = useState(false)
  const [eligMsg, setEligMsg] = useState('')


useEffect(() => {
  async function checkEligibility(address: string) {
    try {
        
      const res = await fetch("/users.json"); 
      const data = await res.json();

      // normalize addresses for case sensitivity
      const match = data.find(
        (row: any) => row.walletAddress === address
      );

      if (match) {
        setEligible(true);
        setEligMsg(`Wallet is eligible! Points: ${match.points}`);
      } else {
        setEligible(false);
        setEligMsg("Wallet is not eligible.");
      }
    } catch (err) {
      console.error("Error reading whitelist.json:", err);
      setEligible(false);
      setMsg("Error checking eligibility.");
    }
  }

  if (selectedAccount?.address) {
    checkEligibility(selectedAccount.address);
  }
}, [selectedAccount]);



  // CONNECT TO API IF USER HAS SELECTED ACCOUNT
  useEffect(() => {
    let unmounted = false;
    if (!selectedAccount) {
      setStatus("error");
      setError("Please connect your wallet first.");
      return;
    }

    if(eligible){
    (async (): Promise<void> => {
      setStatus("connecting");
      try {
        const wsUrl =
          import.meta.env.VITE_XORION_WS ||
          'wss://node01.xorion.network'
          // "wss://ws-proxy-latest-jds3.onrender.com";
        const _api = await ApiPromise.create({
          provider: new WsProvider(wsUrl),
        });
        await _api.isReady;
        if (unmounted) return;
        setApi(_api);
        setStatus("ready");
      } catch (e) {
        setError("Failed to connect.");
        setStatus("error");
      }
    })();
    }
    return () => {
      unmounted = true;
    };
  }, [selectedAccount, eligible]);

  // SET UP MANAGER AND UPDATE STATS
  useEffect(() => {
    if (api && selectedAccount) {
      const m = new AirdropManager(api, selectedAccount);
      setManager(m);
      (async () => {
        setLoading(true);
        setStats(await m.getAirdropStats());
        setLoading(false);
      })();
    }
  }, [api, selectedAccount]);

  // Airdrop events subscription – can skip for now for simplicity.

  function formatTokens(amt) {
    if (!amt) return "--";
    return (parseFloat(amt) / 1e18).toFixed(4);
  }

  function formatNumber(n) {
    n = +n;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toLocaleString();
  }

  async function handleClaim() {
    setClaiming(true);
    setError("");
    setMsg("");
    try {
      await manager.claimAirdrop();
      setMsg("Airdrop claimed successfully!");
      setStats(await manager.getAirdropStats());
    } catch (err) {
      setError(
        "You may have already claimed this airdrop or the claim failed."
      );
    }
    setClaiming(false);
  }

  function handleCopy() {
    if (selectedAccount) {
      navigator.clipboard.writeText(selectedAccount.address);
      setMsg("Copied address!");
      setTimeout(() => setMsg(""), 1500);
    }
  }

  return (
    <div className="max-w-xl mx-auto shadow-2xl rounded-2xl flex flex-col bg-gray-800 p-6 mt-12 items-stretch">
        <div className="mb-4 text-gray-200 text-center font-bold">
            <p>
                Connect Wallet to Check Eligibility
            </p>
        </div>
      <WalletConnection />
      {/* Account Selection */}
      <label className="text-sm text-white mb-2 font-semibold">
        Account
      </label>
      <div className="flex mb-4 gap-2">
        <select
          value={selectedAccount ? selectedAccount.address : ""}
          disabled={true}
          className="rounded px-3 py-2 border border-gray-700 text-base font-mono text-[#efeaff] bg-gray-700 w-full focus:outline-none shadow-sm"
        >
          {selectedAccount && (
            <option value={selectedAccount.address}>
              {/* {selectedAccount.meta.name || selectedAccount.address} */}
              {eligMsg}
            </option>
          )}
        </select>
        <button
          disabled={!selectedAccount}
          aria-label="copy address"
          title="Copy address"
          className="bg-gray-900 cursor-pointer hover:bg-gray-500 rounded shadow-sm px-2 border border-[#ffd6fa]/40"
          tabIndex={-1}
          onClick={handleCopy}
        >
          <FiCopy className="text-white" size={22} />
        </button>
      </div>
      {/* show a text say you are eligible or you are not eligible here  */}

        {/* if wallet is eligible show component below  */}
     {
        selectedAccount && eligible && (
            <>
                 {/* Airdrop Stats */}
      {/* <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-700 p-4 rounded flex flex-col items-center border border-blue-300/30 shadow-sm">
          <span className="text-xs text-[#7cb8ff] font-medium mb-1">
            Total Airdrops
          </span>
          <span className="text-lg font-bold text-[#57d6ff]">
            {stats ? formatNumber(stats.totalAirdrops) : "--"}
          </span>
        </div>
        <div className="bg-gray-700 p-4 rounded flex flex-col items-center border border-pink-200/30 shadow-sm">
          <span className="text-xs text-pink-300 font-medium mb-1">
            Airdrop Amount
          </span>
          <span className="text-lg font-bold text-[#ffb1ec]">
            {stats ? formatTokens(stats.airdropAmount) : "--"} XOR
          </span>
        </div>
      </div> */}
      
      <button
        className={`w-full flex items-center justify-center gap-2 py-3 px-5 rounded-lg
             text-base font-semibold shadow-md transition bg-gray-700
        `}
        style={{ fontWeight: 700, letterSpacing: 0.5 }}
        onClick={handleClaim}
        disabled={claiming || !manager}
      >
        {claiming ? (
          <>
            <FiRefreshCw className="animate-spin" size={20} />
            Claiming...
          </>
        ) : (
          <>
            <FiDroplet size={20} />
            Claim Airdrop Now
          </>
        )}
      </button>
      {/* {msg && !error && (
        <div className="flex items-center mt-4 text-orange-300 font-semibold">
          <FiCheckCircle className="mr-1" /> {msg}
        </div>
      )}
      {error && (
        <div className="flex items-center mt-4 text-pink-400 font-semibold">
          <FiAlertCircle className="mr-1" /> {error}
        </div>
      )} */}

            </>
        )
     }
    </div>
  );
}
