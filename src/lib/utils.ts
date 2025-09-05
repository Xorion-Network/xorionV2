import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type BN from 'bn.js';
import { bsc } from 'wagmi/chains';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a raw tXOR balance (plancks, 1 tXOR = 1e18 plancks) to a human-readable string.
 * @param balanceRaw string | number | BN - the raw balance in plancks
 * @param decimals number - number of decimals (default 18)
 * @param maxFractionDigits number - max decimals to show (default 4)
 * @returns string - formatted tXOR balance
 */
export function formatTxor(balanceRaw: string | number | BN, decimals = 18, maxFractionDigits = 4): string {
  if (balanceRaw == null) return '0.0000';
  let num: number;
  if (typeof balanceRaw === 'string') {
    // Remove commas and spaces
    const clean = balanceRaw.replace(/[,\s]/g, '');
    num = parseFloat(clean);
  } else if (typeof balanceRaw === 'object' && 'toString' in balanceRaw) {
    // BN.js support
    num = parseFloat(balanceRaw.toString());
  } else {
    num = Number(balanceRaw);
  }
  if (!isFinite(num) || num === 0) return '0.0000';
  const divisor = Math.pow(10, decimals);
  const display = num / divisor;
  return display.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
}

// Ethereum
// export const ensureEthereumNetwork = async () => {
//   if (typeof window.ethereum === "undefined") {
//     throw new Error("MetaMask not detected");
//   }

//   const chainId = await window.ethereum.request({ method: "eth_chainId" });

//   if (chainId !== "0x1") {
//     try {
//       await window.ethereum.request({
//         method: "wallet_switchEthereumChain",
//         params: [{ chainId: "0x1" }], 
//       });
//     } catch (switchError: any) {
//       if (switchError.code === 4902) {
//         await window.ethereum.request({
//           method: "wallet_addEthereumChain",
//           params: [
//             {
//               chainId: "0x1",
//               chainName: "Ethereum Mainnet",
//               nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
//               rpcUrls: ["https://rpc.ankr.com/eth"],
//               blockExplorerUrls: ["https://etherscan.io"],
//             },
//           ],
//         });
//       } else {
//         throw switchError;
//       }
//     }
//   }
// };

// bsc 

const addBSCToWallet = async () => {
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: '0x38',
      chainName: 'Binance Smart Chain Mainnet',
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18,
      },
      rpcUrls: ['https://bsc-dataseed.binance.org/'],
      blockExplorerUrls: ['https://bscscan.com/'],
    }],
  });
};


export const ensureBSCNetwork = async () => {
  const BSC_CHAIN = bsc;
  if (typeof window.ethereum === 'undefined') return;
  
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const expectedChainId = `0x${BSC_CHAIN.id.toString(16)}`; // 0x38 for BSC mainnet
  
  if (chainId !== expectedChainId) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: expectedChainId }],
      });
    } catch (error) {
      if (error.code === 4902) {
        await addBSCToWallet();
      }
    }
  }
};
