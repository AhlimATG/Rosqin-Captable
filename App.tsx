
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import {
  Shareholder, ShareClass, ShareholderCategory, FundingRound, ProcessedShareholder,
  CapTableSnapshot, NewFundingRoundFormInput, InvestorDetailInRound, NewShareholderInput, ShareHolding, PotentialNewRoundDetails
} from './types';
import { VOTES_PER_SHARE, LIGHT_THEME_CHART_COLORS, EMPLOYEE_POOL_ID, EMPLOYEE_POOL_NAME } from './constants';
import PieChartComponent from './PieChartComponent';
import Modal from './Modal';
import ShareholderForm from './ShareholderForm';
import CapTableDisplay from './CapTableDisplay';
import FundingRoundForm from './FundingRoundForm';
import FundingHistoryDisplay from './FundingHistoryDisplay';


import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend, Title);


const calculateCapTableSnapshot = (
  currentShareholders: Shareholder[],
  appliedFundingRounds: FundingRound[], // Past rounds already incorporated into currentShareholders
  potentialNewRound?: PotentialNewRoundDetails // For simulation
): CapTableSnapshot => {
  
  // 1. Create a working copy of shareholders based on `currentShareholders`
  // These shareholders already reflect the state *after* all `appliedFundingRounds`
  // (e.g., ESOP increases from past rounds, investors from past rounds are already in `currentShareholders`)
  let workingProcessedShareholders: ProcessedShareholder[] = currentShareholders.map(sh => {
    const holdings: ShareHolding[] = [];
    if (sh.sharesClassA > 0) holdings.push({ shareClass: ShareClass.A, count: sh.sharesClassA });
    if (sh.sharesClassB > 0) holdings.push({ shareClass: ShareClass.B, count: sh.sharesClassB });
    return {
      id: sh.id,
      name: sh.name,
      category: sh.category,
      holdings,
      totalShares: 0, ownershipPercentage: 0, votingPower: 0, votingPercentage: 0,
    };
  });

  let roundPreviewDetailsOutput: CapTableSnapshot['roundPreviewDetails'] | undefined = undefined;

  // 2. Simulate potential new round if details are provided
  if (potentialNewRound) {
    roundPreviewDetailsOutput = {
      name: potentialNewRound.name,
      totalInvestment: potentialNewRound.totalInvestment,
      preMoneyValuation: 0, // Will be calculated
      postMoneyValuation: 0, // Will be calculated
      sharesIssuedToNewInvestors: 0, // Will be calculated
      sharePrice: 0, // Will be calculated
      optionPoolIncreaseShares: potentialNewRound.optionPoolIncreaseShares || 0,
    };

    // 2a. Apply ESOP increase for *this specific potential round*
    const optionPoolIncreaseInSim = potentialNewRound.optionPoolIncreaseShares || 0;
    if (optionPoolIncreaseInSim > 0) {
      let esop = workingProcessedShareholders.find(s => s.id === EMPLOYEE_POOL_ID);
      if (esop) {
        let esopHoldingA = esop.holdings.find(h => h.shareClass === ShareClass.A);
        if (esopHoldingA) esopHoldingA.count += optionPoolIncreaseInSim;
        else esop.holdings.push({ shareClass: ShareClass.A, count: optionPoolIncreaseInSim });
      } else {
        // This case should ideally not happen if ESOP is always ensured
        workingProcessedShareholders.push({
          id: EMPLOYEE_POOL_ID, name: EMPLOYEE_POOL_NAME, category: ShareholderCategory.EMPLOYEE_POOL,
          holdings: [{ shareClass: ShareClass.A, count: optionPoolIncreaseInSim }],
          totalShares: 0, ownershipPercentage: 0, votingPower: 0, votingPercentage: 0,
        });
      }
    }

    // 2b. Calculate total shares *before* adding new investors for this round
    // This includes the ESOP top-up from *this* round.
    const totalExistingSharesBeforeNewInvestors = workingProcessedShareholders.reduce((acc, sh) => 
        acc + sh.holdings.reduce((hAcc, h) => hAcc + h.count, 0), 0);

    // 2c. Determine valuations and shares to issue
    let preMoneyValuation = potentialNewRound.preMoneyValuation || 0;
    let postMoneyValuation = 0;
    let sharesIssuedToNewInvestors = 0;

    if (potentialNewRound.valuationType === 'preMoney' && preMoneyValuation > 0) {
      postMoneyValuation = preMoneyValuation + potentialNewRound.totalInvestment;
      if (preMoneyValuation > 0 && totalExistingSharesBeforeNewInvestors > 0) {
         // New investors get X% of post-money. X = Investment / PostMoney.
         // So they get (Investment / PostMoney) * TotalPostMoneyShares.
         // TotalPostMoneyShares = TotalExistingShares / (1 - Investment/PostMoney)
         // SharesIssued = (Investment/PostMoney) * (TotalExistingShares / (1 - Investment/PostMoney))
         // SharesIssued = Investment * TotalExistingShares / (PostMoney - Investment)
         // SharesIssued = Investment * TotalExistingShares / PreMoney
        sharesIssuedToNewInvestors = Math.round((potentialNewRound.totalInvestment * totalExistingSharesBeforeNewInvestors) / preMoneyValuation);
      }
    } else if (potentialNewRound.valuationType === 'percentage' && potentialNewRound.percentageAcquired && potentialNewRound.percentageAcquired > 0 && potentialNewRound.percentageAcquired < 100) {
      const percAcquiredDecimal = potentialNewRound.percentageAcquired / 100;
      if (potentialNewRound.totalInvestment > 0) {
        postMoneyValuation = potentialNewRound.totalInvestment / percAcquiredDecimal;
        preMoneyValuation = postMoneyValuation - potentialNewRound.totalInvestment;
        // S_new / (S_existing + S_new) = Y
        // S_new = Y * S_existing / (1 - Y)
        sharesIssuedToNewInvestors = Math.round((percAcquiredDecimal * totalExistingSharesBeforeNewInvestors) / (1 - percAcquiredDecimal));
      }
    }
    
    roundPreviewDetailsOutput.preMoneyValuation = preMoneyValuation;
    roundPreviewDetailsOutput.postMoneyValuation = postMoneyValuation;
    roundPreviewDetailsOutput.sharesIssuedToNewInvestors = sharesIssuedToNewInvestors;
    roundPreviewDetailsOutput.sharePrice = sharesIssuedToNewInvestors > 0 ? potentialNewRound.totalInvestment / sharesIssuedToNewInvestors : 0;


    // 2d. Add new investors as a single entity for preview OR individual investors
    if (sharesIssuedToNewInvestors > 0 && potentialNewRound.investors.length > 0) {
      // For simplicity in preview, can aggregate or show first investor.
      // When actually adding round, investors are added individually to main shareholders list.
       const previewInvestorEntityName = `New Investors (${potentialNewRound.name})`;
       workingProcessedShareholders.push({
         id: 'new-investors-preview-' + nanoid(5), // Unique ID for preview
         name: previewInvestorEntityName,
         category: ShareholderCategory.INVESTOR,
         holdings: [{ shareClass: ShareClass.A, count: sharesIssuedToNewInvestors }],
         totalShares: 0, ownershipPercentage: 0, votingPower: 0, votingPercentage: 0,
       });
    }
  }

  // 3. Final calculations on the (potentially simulated) shareholder list
  let totalClassAShares = 0;
  let totalClassBShares = 0;

  workingProcessedShareholders.forEach(sh => {
    sh.holdings.forEach(h => {
      if (h.shareClass === ShareClass.A) totalClassAShares += h.count;
      else if (h.shareClass === ShareClass.B) totalClassBShares += h.count;
    });
  });

  const totalSharesOverall = totalClassAShares + totalClassBShares;
  let totalVotingPower = 0;

  const finalProcessedShareholders = workingProcessedShareholders.map(sh => {
    const shareholderTotalShares = sh.holdings.reduce((sum, h) => sum + h.count, 0);
    const ownershipPercentage = totalSharesOverall > 0 ? (shareholderTotalShares / totalSharesOverall) * 100 : 0;
    const shareholderVotingPower = sh.holdings.reduce((sum, h) => sum + h.count * VOTES_PER_SHARE[h.shareClass], 0);
    totalVotingPower += shareholderVotingPower;
    return { ...sh, totalShares: shareholderTotalShares, ownershipPercentage, votingPower: shareholderVotingPower, votingPercentage: 0 };
  }).filter(sh => sh.totalShares > 0.00001); // Filter out effectively zero share holders

  finalProcessedShareholders.forEach(sh => {
    sh.votingPercentage = totalVotingPower > 0 ? (sh.votingPower / totalVotingPower) * 100 : 0;
  });
  
  const esopEntity = finalProcessedShareholders.find(s => s.id === EMPLOYEE_POOL_ID);
  const esopTotalShares = esopEntity?.totalShares || 0;

  return {
    totalClassAShares,
    totalClassBShares,
    totalSharesOverall,
    totalVotingPower,
    shareholders: finalProcessedShareholders.sort((a,b) => b.ownershipPercentage - a.ownershipPercentage),
    optionPool: {
      totalAllocated: esopTotalShares,
      percentageOfTotal: totalSharesOverall > 0 ? (esopTotalShares / totalSharesOverall * 100) : 0,
    },
    roundPreviewDetails: roundPreviewDetailsOutput
  };
};


const App: React.FC = () => {
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [fundingRounds, setFundingRounds] = useState<FundingRound[]>([]);
  const [currentCapTable, setCurrentCapTable] = useState<CapTableSnapshot | null>(null);
  
  const [isShareholderModalOpen, setIsShareholderModalOpen] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<Shareholder | null>(null);
  
  const [isFundingRoundModalOpen, setIsFundingRoundModalOpen] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null); // Store ID of round being edited
  const [isRoundPreviewModalOpen, setIsRoundPreviewModalOpen] = useState(false);
  const [previewCapTableData, setPreviewCapTableData] = useState<CapTableSnapshot | null>(null);
  const [newRoundDataForConfirmation, setNewRoundDataForConfirmation] = useState<NewFundingRoundFormInput | null>(null);


  // Ensure ESOP is always present
  useEffect(() => {
    setShareholders(prev => {
      if (!prev.find(sh => sh.id === EMPLOYEE_POOL_ID)) {
        return [
          ...prev.filter(s => s.id !== EMPLOYEE_POOL_ID), // remove if accidentally added differently
          {
            id: EMPLOYEE_POOL_ID,
            name: EMPLOYEE_POOL_NAME,
            category: ShareholderCategory.EMPLOYEE_POOL,
            sharesClassA: 0, 
            sharesClassB: 0, // ESOP is Class A only
          }
        ];
      }
      return prev;
    });
  }, []);


  useEffect(() => {
    // Recalculate current cap table whenever shareholders or funding rounds change
    // Note: calculateCapTableSnapshot itself doesn't use appliedFundingRounds to modify shareholders directly,
    // it assumes 'shareholders' state already reflects past rounds.
    // 'appliedFundingRounds' could be used for historical tracking or more complex rollback logic (not implemented).
    setCurrentCapTable(calculateCapTableSnapshot(shareholders, fundingRounds));
  }, [shareholders, fundingRounds]);

  const handleAddOrUpdateShareholder = (data: NewShareholderInput) => {
    if (editingShareholder) {
      setShareholders(prev => prev.map(sh => sh.id === editingShareholder.id ? { ...sh, ...data, sharesClassB: data.category === ShareholderCategory.FOUNDER ? data.sharesClassB : 0 } : sh));
      setEditingShareholder(null);
    } else {
      const newShareholder: Shareholder = { 
        id: nanoid(), 
        ...data,
        sharesClassB: data.category === ShareholderCategory.FOUNDER ? data.sharesClassB : 0
      };
      setShareholders(prev => [...prev, newShareholder]);
    }
    setIsShareholderModalOpen(false);
  };

  const handleEditShareholder = (shareholderId: string) => {
    const shareholderToEdit = shareholders.find(sh => sh.id === shareholderId);
    if (shareholderToEdit) {
      setEditingShareholder(shareholderToEdit);
      setIsShareholderModalOpen(true);
    }
  };

  const handleDeleteShareholder = (shareholderId: string) => {
    if(shareholderId === EMPLOYEE_POOL_ID) {
        alert("The Employee Option Pool cannot be deleted directly.");
        return;
    }
    if (window.confirm("Are you sure you want to delete this shareholder?")) {
      setShareholders(prev => prev.filter(sh => sh.id !== shareholderId));
    }
  };

  // --- Funding Round Handlers ---
  const handleOpenFundingRoundModal = (roundIdToEdit?: string) => {
    if (roundIdToEdit && fundingRounds.length > 0 && fundingRounds[fundingRounds.length - 1].id === roundIdToEdit) {
      const roundToEdit = fundingRounds[fundingRounds.length -1];
      // Convert FundingRound back to NewFundingRoundFormInput shape
      const formInput: NewFundingRoundFormInput = {
        name: roundToEdit.name,
        date: roundToEdit.date,
        valuationType: roundToEdit.valuationType,
        preMoneyValuation: roundToEdit.valuationType === 'preMoney' ? roundToEdit.preMoneyValuation : 0,
        percentageAcquired: roundToEdit.valuationType === 'percentage' ? roundToEdit.percentageAcquiredByNewInvestors || 0 : 0,
        investors: roundToEdit.investors.map(inv => ({ tempId: inv.id, name: inv.name, investmentAmount: inv.investmentAmount})),
        optionPoolIncrease: roundToEdit.optionPoolIncreaseShares,
      };
      setNewRoundDataForConfirmation(formInput); // Populate form
      setEditingRoundId(roundIdToEdit);
    } else {
      setNewRoundDataForConfirmation(null); // Clear for new round
      setEditingRoundId(null);
    }
    setIsFundingRoundModalOpen(true);
  };
  
  const handlePreviewRound = (roundInput: NewFundingRoundFormInput) => {
    const totalInvestment = roundInput.investors.reduce((sum, inv) => sum + inv.investmentAmount, 0);
    const potentialRoundDetails: PotentialNewRoundDetails = {
        name: roundInput.name,
        date: roundInput.date,
        valuationType: roundInput.valuationType,
        preMoneyValuation: roundInput.valuationType === 'preMoney' ? roundInput.preMoneyValuation : undefined,
        percentageAcquired: roundInput.valuationType === 'percentage' ? roundInput.percentageAcquired : undefined,
        totalInvestment: totalInvestment,
        investors: roundInput.investors,
        optionPoolIncreaseShares: roundInput.optionPoolIncrease,
    };
    
    const preview = calculateCapTableSnapshot(shareholders, fundingRounds, potentialRoundDetails);
    setPreviewCapTableData(preview);
    setNewRoundDataForConfirmation(roundInput); // Keep data for final confirmation
    setIsRoundPreviewModalOpen(true);
    setIsFundingRoundModalOpen(false); // Close form modal if open
  };

  const handleConfirmAndAddRound = () => {
    if (!newRoundDataForConfirmation) return;

    const roundInput = newRoundDataForConfirmation;
    const totalInvestment = roundInput.investors.reduce((sum, inv) => sum + inv.investmentAmount, 0);

    // Re-run calculation to get final numbers for the round object
    // This is similar to preview but without adding dummy shareholders
    const tempSnapshotDetailsForRound = calculateCapTableSnapshot(shareholders, fundingRounds, {
        name: roundInput.name,
        date: roundInput.date,
        valuationType: roundInput.valuationType,
        preMoneyValuation: roundInput.valuationType === 'preMoney' ? roundInput.preMoneyValuation : undefined,
        percentageAcquired: roundInput.valuationType === 'percentage' ? roundInput.percentageAcquired : undefined,
        totalInvestment: totalInvestment,
        investors: roundInput.investors, // Pass investors for structure
        optionPoolIncreaseShares: roundInput.optionPoolIncrease,
    }).roundPreviewDetails; // We need the calculated values from the simulation pass

    if (!tempSnapshotDetailsForRound) {
        console.error("Failed to calculate round details for confirmation.");
        alert("Error: Could not finalize round details. Please check inputs.");
        setIsRoundPreviewModalOpen(false);
        setNewRoundDataForConfirmation(null);
        return;
    }
    
    const newRound: FundingRound = {
        id: editingRoundId || nanoid(),
        name: roundInput.name,
        date: roundInput.date,
        valuationType: roundInput.valuationType,
        preMoneyValuation: tempSnapshotDetailsForRound.preMoneyValuation,
        investmentAmount: totalInvestment,
        postMoneyValuation: tempSnapshotDetailsForRound.postMoneyValuation,
        sharesIssuedToNewInvestors: tempSnapshotDetailsForRound.sharesIssuedToNewInvestors,
        sharePrice: tempSnapshotDetailsForRound.sharePrice,
        optionPoolIncreaseShares: roundInput.optionPoolIncrease || 0,
        percentageAcquiredByNewInvestors: roundInput.valuationType === 'percentage' ? roundInput.percentageAcquired : undefined,
        investors: [], // Will be populated below
    };

    let updatedShareholders = [...shareholders];

    // 1. Update ESOP shares if applicable
    if (newRound.optionPoolIncreaseShares > 0) {
        updatedShareholders = updatedShareholders.map(sh => {
            if (sh.id === EMPLOYEE_POOL_ID) {
                return { ...sh, sharesClassA: sh.sharesClassA + newRound.optionPoolIncreaseShares };
            }
            return sh;
        });
    }
    
    // 2. Add new investors as shareholders
    // Distribute sharesIssuedToNewInvestors proportionally to their investment amount in this round.
    if (newRound.sharesIssuedToNewInvestors > 0 && totalInvestment > 0) {
        roundInput.investors.forEach(formInvestor => {
            const proportion = formInvestor.investmentAmount / totalInvestment;
            const sharesForThisInvestor = Math.round(newRound.sharesIssuedToNewInvestors * proportion);
            if (sharesForThisInvestor > 0) {
                 // Check if investor exists, if so, update. Otherwise, add.
                const existingInvestor = updatedShareholders.find(sh => sh.name.toLowerCase() === formInvestor.name.toLowerCase() && sh.category === ShareholderCategory.INVESTOR);
                if (existingInvestor) {
                    updatedShareholders = updatedShareholders.map(sh => 
                        sh.id === existingInvestor.id 
                        ? { ...sh, sharesClassA: sh.sharesClassA + sharesForThisInvestor }
                        : sh
                    );
                    newRound.investors.push({
                        id: formInvestor.tempId, // or existingInvestor.id if preferred
                        shareholderId: existingInvestor.id,
                        name: formInvestor.name,
                        investmentAmount: formInvestor.investmentAmount,
                        sharesAcquired: sharesForThisInvestor,
                    });
                } else {
                    const newInvestorId = nanoid();
                    updatedShareholders.push({
                        id: newInvestorId,
                        name: formInvestor.name,
                        category: ShareholderCategory.INVESTOR,
                        sharesClassA: sharesForThisInvestor,
                        sharesClassB: 0, // Investors get Class A
                    });
                    newRound.investors.push({
                        id: formInvestor.tempId, // or newInvestorId
                        shareholderId: newInvestorId,
                        name: formInvestor.name,
                        investmentAmount: formInvestor.investmentAmount,
                        sharesAcquired: sharesForThisInvestor,
                    });
                }
            }
        });
    }
    
    // Adjust total shares issued if rounding caused minor discrepancies
    const actualSharesAdded = newRound.investors.reduce((sum, inv) => sum + inv.sharesAcquired, 0);
    newRound.sharesIssuedToNewInvestors = actualSharesAdded;


    setShareholders(updatedShareholders);

    if (editingRoundId) {
        setFundingRounds(prevRounds => prevRounds.map(r => r.id === editingRoundId ? newRound : r));
    } else {
        setFundingRounds(prevRounds => [...prevRounds, newRound]);
    }

    setIsFundingRoundModalOpen(false);
    setIsRoundPreviewModalOpen(false);
    setNewRoundDataForConfirmation(null);
    setEditingRoundId(null);
    setPreviewCapTableData(null);
  };

  const handleDeleteFundingRound = (roundId: string) => {
    // ONLY allow deleting the LATEST round for simplicity
    if (fundingRounds.length > 0 && fundingRounds[fundingRounds.length - 1].id === roundId) {
      if (window.confirm("Are you sure you want to delete the latest funding round? This action cannot be undone easily and will revert shareholder changes from this round.")) {
        const roundToDelete = fundingRounds[fundingRounds.length - 1];
        let revertedShareholders = [...shareholders];

        // Revert ESOP increase
        if (roundToDelete.optionPoolIncreaseShares > 0) {
          revertedShareholders = revertedShareholders.map(sh => 
            sh.id === EMPLOYEE_POOL_ID 
            ? { ...sh, sharesClassA: Math.max(0, sh.sharesClassA - roundToDelete.optionPoolIncreaseShares) } 
            : sh
          );
        }

        // Revert shares from investors of this round
        roundToDelete.investors.forEach(invInRound => {
          if (invInRound.shareholderId) {
             revertedShareholders = revertedShareholders.map(sh => {
                if (sh.id === invInRound.shareholderId) {
                    const newShares = Math.max(0, sh.sharesClassA - invInRound.sharesAcquired);
                    // If this investor only existed due to this round, and shares become 0, consider removing them or marking inactive
                    // For now, just reduce shares. If shares are 0, they might get filtered by CapTableDisplay logic.
                    return { ...sh, sharesClassA: newShares }; 
                }
                return sh;
            }).filter(sh => !(sh.id === invInRound.shareholderId && sh.sharesClassA <= 0 && sh.sharesClassB <= 0 && sh.category === ShareholderCategory.INVESTOR && !fundingRounds.slice(0, -1).some(fr => fr.investors.some(i => i.shareholderId === sh.id)) )); // Remove investor if they became 0 and were new in this round
          }
        });
        
        setShareholders(revertedShareholders);
        setFundingRounds(prevRounds => prevRounds.slice(0, -1));
      }
    } else {
      alert("Only the most recent funding round can be deleted through this interface.");
    }
  };
  
  const ownershipData = useMemo(() => {
    if (!currentCapTable) return { labels: [], datasets: [] };
    return {
        labels: currentCapTable.shareholders.map(sh => `${sh.name} (${sh.ownershipPercentage.toFixed(2)}%)`),
        datasets: [{
            label: 'Ownership %',
            data: currentCapTable.shareholders.map(sh => sh.ownershipPercentage),
        }] // PieChartComponent will apply colors
    };
  }, [currentCapTable]);

 const votingData = useMemo(() => {
    if (!currentCapTable) return { labels: [], datasets: [] };
    return {
        labels: currentCapTable.shareholders.map(sh => `${sh.name} (${sh.votingPercentage.toFixed(2)}%)`),
        datasets: [{
            label: 'Voting Power %',
            data: currentCapTable.shareholders.map(sh => sh.votingPercentage),
        }] // PieChartComponent will apply colors
    };
 }, [currentCapTable]);


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-700">
            CapTable Pro
          </h1>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        <section id="shareholder-management" className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-slate-700">Shareholders</h2>
                <button
                    onClick={() => { setEditingShareholder(null); setIsShareholderModalOpen(true); }}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Add Shareholder
                </button>
            </div>
            <CapTableDisplay
                snapshot={currentCapTable}
                title="Current Cap Table"
                onEditShareholder={handleEditShareholder}
                onDeleteShareholder={handleDeleteShareholder}
                isShareholderManagementEnabled={true}
            />
        </section>

        {currentCapTable && currentCapTable.shareholders.length > 0 && (
            <section id="visualizations" className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-semibold text-slate-700 mb-6 text-center">Ownership & Voting Distribution</h2>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="h-80 md:h-96">
                        <PieChartComponent data={ownershipData} titleText="Ownership Distribution"/>
                    </div>
                    <div className="h-80 md:h-96">
                        <PieChartComponent data={votingData} titleText="Voting Power Distribution"/>
                    </div>
                </div>
            </section>
        )}
        
        <section id="funding-rounds-management" className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-slate-700">Funding Rounds</h2>
                <button
                    onClick={() => handleOpenFundingRoundModal()}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors flex items-center"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                     <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                   </svg>
                    Add Funding Round
                </button>
            </div>
             <FundingHistoryDisplay 
                rounds={fundingRounds} 
                onEdit={(roundId) => handleOpenFundingRoundModal(roundId)} // Only latest editable for now
                onDelete={handleDeleteFundingRound} // Only latest deletable
            />
        </section>

        <Modal
          isOpen={isShareholderModalOpen}
          onClose={() => { setIsShareholderModalOpen(false); setEditingShareholder(null); }}
          title={editingShareholder ? "Edit Shareholder" : "Add New Shareholder"}
          size="xl"
        >
          <ShareholderForm
            onSubmit={handleAddOrUpdateShareholder}
            onCancel={() => { setIsShareholderModalOpen(false); setEditingShareholder(null); }}
            initialData={editingShareholder}
          />
        </Modal>

        <Modal
            isOpen={isFundingRoundModalOpen}
            onClose={() => {
                setIsFundingRoundModalOpen(false);
                setNewRoundDataForConfirmation(null); // Clear form data on close
                setEditingRoundId(null);
            }}
            title={editingRoundId ? "Edit Funding Round" : "Add / Simulate Funding Round"}
            size="3xl"
        >
            <FundingRoundForm
                onSubmit={handlePreviewRound} // Submit first goes to preview
                onCancel={() => {
                    setIsFundingRoundModalOpen(false);
                    setNewRoundDataForConfirmation(null);
                    setEditingRoundId(null);
                }}
                initialData={newRoundDataForConfirmation} // Used for pre-filling if editing
                existingShareholdersCount={shareholders.filter(s => s.id !== EMPLOYEE_POOL_ID).length}
                totalExistingShares={currentCapTable?.totalSharesOverall || 0}
            />
        </Modal>

        <Modal
            isOpen={isRoundPreviewModalOpen}
            onClose={() => {
                setIsRoundPreviewModalOpen(false);
                setPreviewCapTableData(null);
                // setNewRoundDataForConfirmation(null); // Keep data for potential confirmation
            }}
            title={`Preview: ${previewCapTableData?.roundPreviewDetails?.name || 'New Round Impact'}`}
            size="5xl"
        >
            {previewCapTableData && (
                <div className="space-y-6">
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <h3 className="text-lg font-semibold text-indigo-700 mb-2">Round Summary (Preview)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                            <p><strong>Total Investment:</strong> ${previewCapTableData.roundPreviewDetails?.totalInvestment.toLocaleString()}</p>
                            <p><strong>Pre-Money Valuation:</strong> ${previewCapTableData.roundPreviewDetails?.preMoneyValuation.toLocaleString()}</p>
                            <p><strong>Post-Money Valuation:</strong> ${previewCapTableData.roundPreviewDetails?.postMoneyValuation.toLocaleString()}</p>
                            <p><strong>Shares to New Investors:</strong> {previewCapTableData.roundPreviewDetails?.sharesIssuedToNewInvestors.toLocaleString()}</p>
                            <p><strong>Share Price:</strong> ${previewCapTableData.roundPreviewDetails?.sharePrice.toFixed(4)}</p>
                            <p><strong>ESOP Increase:</strong> {previewCapTableData.roundPreviewDetails?.optionPoolIncreaseShares.toLocaleString()} shares</p>
                        </div>
                    </div>

                    <CapTableDisplay
                        snapshot={previewCapTableData}
                        title="Cap Table After This Round (Preview)"
                        isPreview={true}
                    />
                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRoundPreviewModalOpen(false);
                                // Optionally re-open form if user wants to edit more:
                                // setIsFundingRoundModalOpen(true); 
                            }}
                            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
                        >
                            Back to Edit Round
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmAndAddRound}
                            className="px-6 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            Confirm & Add Round to CapTable
                        </button>
                    </div>
                </div>
            )}
        </Modal>

      </main>

      <footer className="text-center py-8 mt-12 border-t border-slate-200">
        <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} CapTable Pro. Your Equity, Clarified.</p>
      </footer>
    </div>
  );
};

export default App;