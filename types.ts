export enum ShareClass {
  A = "Class A", // 1 vote
  B = "Class B", // 10 votes
}

export enum ShareholderCategory {
  FOUNDER = "Founder",
  INVESTOR = "Investor",
  EMPLOYEE_POOL = "Employee Option Pool",
  EMPLOYEE = "Employee", // For granted options from pool
}

export interface ShareHolding {
  shareClass: ShareClass;
  count: number;
}

export interface Shareholder {
  id: string;
  name: string;
  category: ShareholderCategory;
  sharesClassA: number;
  sharesClassB: number;
  isEditing?: boolean; // For UI state if needed for inline editing
}

export interface InvestorDetailInRound {
  id: string; // Unique ID for this investor entry within the round
  shareholderId?: string; // Link to an existing Shareholder ID if applicable for existing investors
  name: string; // Could be a new investor or existing name reference
  investmentAmount: number;
  sharesAcquired: number; // Calculated and stored
}

export interface FundingRound {
  id: string;
  name: string; // e.g., Seed, Series A
  date: string;
  preMoneyValuation: number;
  investmentAmount: number; // Total investment in this round
  postMoneyValuation: number;
  investors: InvestorDetailInRound[]; // Store processed investor details
  sharesIssuedToNewInvestors: number; // Total new Class A shares for new investors in this round
  sharePrice: number;
  optionPoolIncreaseShares: number; // Class A shares added to ESOP
  valuationType: 'preMoney' | 'percentage'; // Store how it was defined
  percentageAcquiredByNewInvestors?: number; // If defined by percentage
}

export interface NewShareholderInput {
  name: string;
  category: ShareholderCategory;
  sharesClassA: number;
  sharesClassB: number;
}

// For the FundingRoundForm
export interface NewFundingRoundFormInput {
  name: string;
  date: string;
  valuationType: 'preMoney' | 'percentage';
  preMoneyValuation: number; // For preMoney type
  percentageAcquired: number; // For percentage type
  
  // Raw investor inputs from form
  investors: Array<{ tempId: string; name: string; investmentAmount: number }>;
  
  optionPoolIncrease: number; // Shares to add to ESOP
  
  // These will be calculated and displayed in the form, but not directly input by user
  // totalInvestment: number; // Sum of investors[*].investmentAmount
  // calculatedPostMoneyValuation: number;
  // calculatedSharesToIssue: number;
  // calculatedSharePrice: number;
}


// This is used for calculation, might differ from form input
export interface PotentialNewRoundDetails {
  name: string;
  date: string;
  valuationType: 'preMoney' | 'percentage';
  preMoneyValuation?: number;       // If valuationType is 'preMoney'
  percentageAcquired?: number;    // If valuationType is 'percentage'
  totalInvestment: number;          // Sum of all investor amounts
  investors: Array<{ name: string; investmentAmount: number; tempId: string }>; // Simplified for calc
  optionPoolIncreaseShares?: number;
  // For internal calculation, not direct input to this type:
  // sharesToIssue?: number; // Will be calculated within snapshot function
}


export interface ProcessedShareholder {
  id: string;
  name: string;
  category: ShareholderCategory;
  holdings: ShareHolding[];
  totalShares: number;
  ownershipPercentage: number;
  votingPower: number;
  votingPercentage: number;
}

export interface CapTableSnapshot {
  totalClassAShares: number;
  totalClassBShares: number;
  totalSharesOverall: number;
  totalVotingPower: number;
  shareholders: ProcessedShareholder[];
  optionPool: {
    totalAllocated: number;
    percentageOfTotal: number;
  };
  // Optional: for previewing a round's impact
  roundPreviewDetails?: {
    name: string;
    totalInvestment: number;
    preMoneyValuation: number;
    postMoneyValuation: number;
    sharesIssuedToNewInvestors: number;
    sharePrice: number;
    optionPoolIncreaseShares: number;
  }
}