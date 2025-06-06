
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
  appliedFundingRounds: FundingRound[], 
  potentialNewRound?: PotentialNewRoundDetails
): CapTableSnapshot => {
  
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

  if (potentialNewRound) {
    roundPreviewDetailsOutput = {
      name: potentialNewRound.name,
      totalInvestment: potentialNewRound.totalInvestment,
      preMoneyValuation: 0,
      postMoneyValuation: 0,
      sharesIssuedToNewInvestors: 0,
      sharePrice: 0,
      optionPoolIncreaseShares: potentialNewRound.optionPoolIncreaseShares || 0,
    };

    const optionPoolIncreaseInSim = potentialNewRound.optionPoolIncreaseShares || 0;
    if (optionPoolIncreaseInSim > 0) {
      let esop = workingProcessedShareholders.find(s => s.id === EMPLOYEE_POOL_ID);
      if (esop) {
        let esopHoldingA = esop.holdings.find(h => h.shareClass === ShareClass.A);
        if (esopHoldingA) esopHoldingA.count += optionPoolIncreaseInSim;
        else esop.holdings.push({ shareClass: ShareClass.A, count: optionPoolIncreaseInSim });
      } else {
        workingProcessedShareholders.push({
          id: EMPLOYEE_POOL_ID, name: EMPLOYEE_POOL_NAME, category: ShareholderCategory.EMPLOYEE_POOL,
          holdings: [{ shareClass: ShareClass.A, count: optionPoolIncreaseInSim }],
          totalShares: 0, ownershipPercentage: 0, votingPower: 0, votingPercentage: 0,
        });
      }
    }

    const totalExistingSharesBeforeNewInvestors = workingProcessedShareholders.reduce((acc, sh) => 
        acc + sh.holdings.reduce((hAcc, h) => hAcc + h.count, 0), 0);

    let preMoneyValuation = potentialNewRound.preMoneyValuation || 0;
    let postMoneyValuation = 0;
    let sharesIssuedToNewInvestors = 0;

    if (potentialNewRound.valuationType === 'preMoney' && preMoneyValuation > 0) {
      postMoneyValuation = preMoneyValuation + potentialNewRound.totalInvestment;
      if (preMoneyValuation > 0 && totalExistingSharesBeforeNewInvestors > 0) {
        sharesIssuedToNewInvestors = Math.round((potentialNewRound.totalInvestment * totalExistingSharesBeforeNewInvestors) / preMoneyValuation);
      }
    } else if (potentialNewRound.valuationType === 'percentage' && potentialNewRound.percentageAcquired && potentialNewRound.percentageAcquired > 0 && potentialNewRound.percentageAcquired < 100) {
      const percAcquiredDecimal = potentialNewRound.percentageAcquired / 100;
      if (potentialNewRound.totalInvestment > 0) {
        postMoneyValuation = potentialNewRound.totalInvestment / percAcquiredDecimal;
        preMoneyValuation = postMoneyValuation - potentialNewRound.totalInvestment;
        sharesIssuedToNewInvestors = Math.round((percAcquiredDecimal * totalExistingSharesBeforeNewInvestors) / (1 - percAcquiredDecimal));
      }
    }
    
    roundPreviewDetailsOutput.preMoneyValuation = preMoneyValuation;
    roundPreviewDetailsOutput.postMoneyValuation = postMoneyValuation;
    roundPreviewDetailsOutput.sharesIssuedToNewInvestors = sharesIssuedToNewInvestors;
    roundPreviewDetailsOutput.sharePrice = sharesIssuedToNewInvestors > 0 ? potentialNewRound.totalInvestment / sharesIssuedToNewInvestors : 0;

    if (sharesIssuedToNewInvestors > 0 && potentialNewRound.investors.length > 0) {
       const previewInvestorEntityName = `New Investors (${potentialNewRound.name})`;
       workingProcessedShareholders.push({
         id: 'new-investors-preview-' + nanoid(5), 
         name: previewInvestorEntityName,
         category: ShareholderCategory.INVESTOR,
         holdings: [{ shareClass: ShareClass.A, count: sharesIssuedToNewInvestors }],
         totalShares: 0, ownershipPercentage: 0, votingPower: 0, votingPercentage: 0,
       });
    }
  }

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
  }).filter(sh => sh.totalShares > 0.00001); 

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
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null); 
  const [isRoundPreviewModalOpen, setIsRoundPreviewModalOpen] = useState(false);
  const [previewCapTableData, setPreviewCapTableData] = useState<CapTableSnapshot | null>(null);
  const [newRoundDataForConfirmation, setNewRoundDataForConfirmation] = useState<NewFundingRoundFormInput | null>(null);

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Load data from localStorage and initialize read-only mode on mount
  useEffect(() => {
    let initialShareholders: Shareholder[] = [];
    try {
      const storedShareholders = localStorage.getItem('capTableShareholders');
      if (storedShareholders) {
        initialShareholders = JSON.parse(storedShareholders);
      }
    } catch (e) {
      console.error("Error parsing shareholders from localStorage", e);
    }

    if (!initialShareholders.find(sh => sh.id === EMPLOYEE_POOL_ID)) {
      const esopIndex = initialShareholders.findIndex(sh => sh.id === EMPLOYEE_POOL_ID);
      if (esopIndex !== -1) {
          initialShareholders.splice(esopIndex, 1);
      }
      initialShareholders.push({
        id: EMPLOYEE_POOL_ID,
        name: EMPLOYEE_POOL_NAME,
        category: ShareholderCategory.EMPLOYEE_POOL,
        sharesClassA: 0,
        sharesClassB: 0,
      });
    }
    setShareholders(initialShareholders);

    try {
      const storedFundingRounds = localStorage.getItem('capTableFundingRounds');
      if (storedFundingRounds) {
        setFundingRounds(JSON.parse(storedFundingRounds));
      } else {
        setFundingRounds([]);
      }
    } catch (e) {
      console.error("Error parsing funding rounds from localStorage", e);
      setFundingRounds([]);
    }

    const queryParams = new URLSearchParams(window.location.search);
    setIsReadOnly(queryParams.get('mode') === 'view');
  }, []);

  // Save shareholders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('capTableShareholders', JSON.stringify(shareholders));
  }, [shareholders]);

  // Save fundingRounds to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('capTableFundingRounds', JSON.stringify(fundingRounds));
  }, [fundingRounds]);

  useEffect(() => {
    setCurrentCapTable(calculateCapTableSnapshot(shareholders, fundingRounds));
  }, [shareholders, fundingRounds]);

  const handleAddOrUpdateShareholder = (data: NewShareholderInput) => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    const shareholderToEdit = shareholders.find(sh => sh.id === shareholderId);
    if (shareholderToEdit) {
      setEditingShareholder(shareholderToEdit);
      setIsShareholderModalOpen(true);
    }
  };

  const handleDeleteShareholder = (shareholderId: string) => {
    if (isReadOnly) return;
    if(shareholderId === EMPLOYEE_POOL_ID) {
        alert("The Employee Option Pool cannot be deleted directly.");
        return;
    }
    if (window.confirm("Are you sure you want to delete this shareholder?")) {
      setShareholders(prev => prev.filter(sh => sh.id !== shareholderId));
    }
  };

  const handleOpenFundingRoundModal = (roundIdToEdit?: string) => {
    if (isReadOnly) return;
    if (roundIdToEdit && fundingRounds.length > 0 && fundingRounds[fundingRounds.length - 1].id === roundIdToEdit) {
      const roundToEdit = fundingRounds[fundingRounds.length -1];
      const formInput: NewFundingRoundFormInput = {
        name: roundToEdit.name,
        date: roundToEdit.date,
        valuationType: roundToEdit.valuationType,
        preMoneyValuation: roundToEdit.valuationType === 'preMoney' ? roundToEdit.preMoneyValuation : 0,
        percentageAcquired: roundToEdit.valuationType === 'percentage' ? roundToEdit.percentageAcquiredByNewInvestors || 0 : 0,
        investors: roundToEdit.investors.map(inv => ({ tempId: inv.id, name: inv.name, investmentAmount: inv.investmentAmount})),
        optionPoolIncrease: roundToEdit.optionPoolIncreaseShares,
      };
      setNewRoundDataForConfirmation(formInput); 
      setEditingRoundId(roundIdToEdit);
    } else {
      setNewRoundDataForConfirmation(null); 
      setEditingRoundId(null);
    }
    setIsFundingRoundModalOpen(true);
  };
  
  const handlePreviewRound = (roundInput: NewFundingRoundFormInput) => {
    if (isReadOnly) return;
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
    setNewRoundDataForConfirmation(roundInput); 
    setIsRoundPreviewModalOpen(true);
    setIsFundingRoundModalOpen(false); 
  };

  const handleConfirmAndAddRound = () => {
    if (isReadOnly || !newRoundDataForConfirmation) return;

    const roundInput = newRoundDataForConfirmation;
    const totalInvestment = roundInput.investors.reduce((sum, inv) => sum + inv.investmentAmount, 0);

    const tempSnapshotDetailsForRound = calculateCapTableSnapshot(shareholders, fundingRounds, {
        name: roundInput.name,
        date: roundInput.date,
        valuationType: roundInput.valuationType,
        preMoneyValuation: roundInput.valuationType === 'preMoney' ? roundInput.preMoneyValuation : undefined,
        percentageAcquired: roundInput.valuationType === 'percentage' ? roundInput.percentageAcquired : undefined,
        totalInvestment: totalInvestment,
        investors: roundInput.investors, 
        optionPoolIncreaseShares: roundInput.optionPoolIncrease,
    }).roundPreviewDetails; 

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
        investors: [], 
    };

    let updatedShareholders = [...shareholders];

    if (newRound.optionPoolIncreaseShares > 0) {
        updatedShareholders = updatedShareholders.map(sh => {
            if (sh.id === EMPLOYEE_POOL_ID) {
                return { ...sh, sharesClassA: sh.sharesClassA + newRound.optionPoolIncreaseShares };
            }
            return sh;
        });
    }
    
    if (newRound.sharesIssuedToNewInvestors > 0 && totalInvestment > 0) {
        roundInput.investors.forEach(formInvestor => {
            const proportion = formInvestor.investmentAmount / totalInvestment;
            const sharesForThisInvestor = Math.round(newRound.sharesIssuedToNewInvestors * proportion);
            if (sharesForThisInvestor > 0) {
                const existingInvestor = updatedShareholders.find(sh => sh.name.toLowerCase() === formInvestor.name.toLowerCase() && sh.category === ShareholderCategory.INVESTOR);
                if (existingInvestor) {
                    updatedShareholders = updatedShareholders.map(sh => 
                        sh.id === existingInvestor.id 
                        ? { ...sh, sharesClassA: sh.sharesClassA + sharesForThisInvestor }
                        : sh
                    );
                    newRound.investors.push({
                        id: formInvestor.tempId, 
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
                        sharesClassB: 0, 
                    });
                    newRound.investors.push({
                        id: formInvestor.tempId, 
                        shareholderId: newInvestorId,
                        name: formInvestor.name,
                        investmentAmount: formInvestor.investmentAmount,
                        sharesAcquired: sharesForThisInvestor,
                    });
                }
            }
        });
    }
    
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
    if (isReadOnly) return;
    if (fundingRounds.length > 0 && fundingRounds[fundingRounds.length - 1].id === roundId) {
      if (window.confirm("Are you sure you want to delete the latest funding round? This action cannot be undone easily and will revert shareholder changes from this round.")) {
        const roundToDelete = fundingRounds[fundingRounds.length - 1];
        let revertedShareholders = [...shareholders];

        if (roundToDelete.optionPoolIncreaseShares > 0) {
          revertedShareholders = revertedShareholders.map(sh => 
            sh.id === EMPLOYEE_POOL_ID 
            ? { ...sh, sharesClassA: Math.max(0, sh.sharesClassA - roundToDelete.optionPoolIncreaseShares) } 
            : sh
          );
        }

        roundToDelete.investors.forEach(invInRound => {
          if (invInRound.shareholderId) {
             revertedShareholders = revertedShareholders.map(sh => {
                if (sh.id === invInRound.shareholderId) {
                    const newShares = Math.max(0, sh.sharesClassA - invInRound.sharesAcquired);
                    return { ...sh, sharesClassA: newShares }; 
                }
                return sh;
            }).filter(sh => !(sh.id === invInRound.shareholderId && sh.sharesClassA <= 0 && sh.sharesClassB <= 0 && sh.category === ShareholderCategory.INVESTOR && !fundingRounds.slice(0, -1).some(fr => fr.investors.some(i => i.shareholderId === sh.id)) )); 
          }
        });
        
        setShareholders(revertedShareholders);
        setFundingRounds(prevRounds => prevRounds.slice(0, -1));
      }
    } else {
      alert("Only the most recent funding round can be deleted through this interface.");
    }
  };

  const handleOpenShareModal = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('mode', 'view');
    setShareableLink(currentUrl.toString());
    setLinkCopied(false);
    setIsShareModalOpen(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableLink).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000); // Reset after 2 seconds
    }).catch(err => {
        console.error('Failed to copy link: ', err);
        alert('Failed to copy link. Please copy it manually.');
    });
  };
  
  const ownershipData = useMemo(() => {
    if (!currentCapTable) return { labels: [], datasets: [] };
    return {
        labels: currentCapTable.shareholders.map(sh => `${sh.name} (${sh.ownershipPercentage.toFixed(2)}%)`),
        datasets: [{
            label: 'Ownership %',
            data: currentCapTable.shareholders.map(sh => sh.ownershipPercentage),
        }] 
    };
  }, [currentCapTable]);

 const votingData = useMemo(() => {
    if (!currentCapTable) return { labels: [], datasets: [] };
    return {
        labels: currentCapTable.shareholders.map(sh => `${sh.name} (${sh.votingPercentage.toFixed(2)}%)`),
        datasets: [{
            label: 'Voting Power %',
            data: currentCapTable.shareholders.map(sh => sh.votingPercentage),
        }] 
    };
 }, [currentCapTable]);


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-700">
            CapTable Pro
          </h1>
          <div className="flex items-center space-x-3">
            {isReadOnly && (
              <span className="px-3 py-1 text-sm font-semibold text-orange-700 bg-orange-100 rounded-full">
                Read-Only Mode
              </span>
            )}
            <button
              onClick={handleOpenShareModal}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 hover:bg-indigo-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center"
              title="Share CapTable (Read-Only)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1.5">
                <path d="M13 4.5a2.5 2.5 0 11.702 4.289l-4.018 2.316a2.5 2.5 0 11-.3-.518l4.019-2.316A2.5 2.5 0 0113 4.5zM6.5 12a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM13 15.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
                <path d="M12.982 5.211l-4.018 2.316A2.522 2.522 0 009 7.5a2.5 2.5 0 10-1.72 4.298l4.019 2.316a2.5 2.5 0 10.299-.518L7.562 11.28A2.522 2.522 0 007 11.5a2.5 2.5 0 101.72-4.298L12.74 4.886a2.5 2.5 0 10.242.325z" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        <section id="shareholder-management" className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-slate-700">Shareholders</h2>
                {!isReadOnly && (
                    <button
                        onClick={() => { setEditingShareholder(null); setIsShareholderModalOpen(true); }}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                        </svg>
                        Add Shareholder
                    </button>
                )}
            </div>
            <CapTableDisplay
                snapshot={currentCapTable}
                title="Current Cap Table"
                onEditShareholder={handleEditShareholder}
                onDeleteShareholder={handleDeleteShareholder}
                isShareholderManagementEnabled={!isReadOnly}
                isReadOnly={isReadOnly}
            />
        </section>

        {currentCapTable && currentCapTable.shareholders.length > (currentCapTable.shareholders.find(sh => sh.id === EMPLOYEE_POOL_ID && sh.totalShares === 0) ? 1 : 0) && (
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
                {!isReadOnly && (
                    <button
                        onClick={() => handleOpenFundingRoundModal()}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors flex items-center"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                         <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                       </svg>
                        Add Funding Round
                    </button>
                )}
            </div>
             <FundingHistoryDisplay 
                rounds={fundingRounds} 
                onEdit={(roundId) => handleOpenFundingRoundModal(roundId)} 
                onDelete={handleDeleteFundingRound}
                isReadOnly={isReadOnly}
            />
        </section>

        {!isReadOnly && (
            <>
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
                        setNewRoundDataForConfirmation(null); 
                        setEditingRoundId(null);
                    }}
                    title={editingRoundId ? "Edit Funding Round" : "Add / Simulate Funding Round"}
                    size="3xl"
                >
                    <FundingRoundForm
                        onSubmit={handlePreviewRound} 
                        onCancel={() => {
                            setIsFundingRoundModalOpen(false);
                            setNewRoundDataForConfirmation(null);
                            setEditingRoundId(null);
                        }}
                        initialData={newRoundDataForConfirmation} 
                        existingShareholdersCount={shareholders.filter(s => s.id !== EMPLOYEE_POOL_ID && (s.sharesClassA > 0 || s.sharesClassB > 0)).length}
                        totalExistingShares={currentCapTable?.totalSharesOverall || 0}
                    />
                </Modal>
             </>
        )}

        <Modal 
            isOpen={isRoundPreviewModalOpen}
            onClose={() => {
                setIsRoundPreviewModalOpen(false);
                setPreviewCapTableData(null);
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
                        isReadOnly={isReadOnly} 
                    />
                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRoundPreviewModalOpen(false);
                            }}
                            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
                        >
                           {isReadOnly ? "Close Preview" : "Back to Edit Round"}
                        </button>
                        {!isReadOnly && (
                            <button
                                type="button"
                                onClick={handleConfirmAndAddRound}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                                Confirm & Add Round to CapTable
                            </button>
                        )}
                    </div>
                </div>
            )}
        </Modal>

        <Modal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title="Share CapTable (Read-Only)"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Share this link with others to give them read-only access to the current cap table:
            </p>
            <input
              type="text"
              value={shareableLink}
              readOnly
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={handleCopyLink}
              className={`w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm transition-colors duration-150 ease-in-out
                ${linkCopied 
                  ? 'bg-green-500 hover:bg-green-600 focus:ring-green-400' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'}
                focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              {linkCopied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </Modal>

      </main>

      <footer className="text-center py-8 mt-12 border-t border-slate-200">
        <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} CapTable Pro. Your Equity, Clarified.</p>
      </footer>
    </div>
  );
};

export default App;
