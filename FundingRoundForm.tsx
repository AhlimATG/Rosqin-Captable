import React, { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { NewFundingRoundFormInput } from './types'; // Assuming types define this structure
import { EMPLOYEE_POOL_ID } from './constants';

interface FundingRoundFormProps {
  onSubmit: (data: NewFundingRoundFormInput) => void;
  onCancel: () => void;
  initialData?: NewFundingRoundFormInput | null;
  existingShareholdersCount: number; // To warn if no pre-existing shareholders
  totalExistingShares: number; // For % calculation
}

const FundingRoundForm: React.FC<FundingRoundFormProps> = ({ 
    onSubmit, onCancel, initialData, existingShareholdersCount, totalExistingShares 
}) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [valuationType, setValuationType] = useState<'preMoney' | 'percentage'>('preMoney');
  const [preMoneyValuation, setPreMoneyValuation] = useState<number>(0);
  const [percentageAcquired, setPercentageAcquired] = useState<number>(0); // Percent, e.g., 10 for 10%
  const [investors, setInvestors] = useState<Array<{ tempId: string; name: string; investmentAmount: number }>>([{ tempId: nanoid(5), name: '', investmentAmount: 0 }]);
  const [optionPoolIncrease, setOptionPoolIncrease] = useState<number>(0);

  // Calculated display values
  const [totalInvestment, setTotalInvestment] = useState<number>(0);
  const [calculatedPostMoney, setCalculatedPostMoney] = useState<number>(0);
  const [calculatedPreMoneyFromPercentage, setCalculatedPreMoneyFromPercentage] = useState<number>(0);
  const [sharesToIssue, setSharesToIssue] = useState<number>(0);
  const [sharePrice, setSharePrice] = useState<number>(0);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDate(initialData.date || new Date().toISOString().split('T')[0]);
      setValuationType(initialData.valuationType || 'preMoney');
      setPreMoneyValuation(initialData.preMoneyValuation || 0);
      setPercentageAcquired(initialData.percentageAcquired || 0);
      setInvestors(initialData.investors && initialData.investors.length > 0 ? initialData.investors : [{ tempId: nanoid(5), name: '', investmentAmount: 0 }]);
      setOptionPoolIncrease(initialData.optionPoolIncrease || 0);
    } else {
      // Reset to defaults for a new form
      setName('');
      setDate(new Date().toISOString().split('T')[0]);
      setValuationType('preMoney');
      setPreMoneyValuation(0);
      setPercentageAcquired(0);
      setInvestors([{ tempId: nanoid(5), name: '', investmentAmount: 0 }]);
      setOptionPoolIncrease(0);
    }
  }, [initialData]);

  const calculateDerivedValues = useCallback(() => {
    const currentTotalInvestment = investors.reduce((sum, inv) => sum + (Number(inv.investmentAmount) || 0), 0);
    setTotalInvestment(currentTotalInvestment);

    let currentPreMoney = valuationType === 'preMoney' ? (Number(preMoneyValuation) || 0) : 0;
    let currentPostMoney = 0;
    let currentSharesToIssue = 0;
    let currentSharePrice = 0;

    const sharesBeforeNewInvestors = totalExistingShares + (Number(optionPoolIncrease) || 0);

    if (valuationType === 'preMoney') {
        currentPostMoney = currentPreMoney + currentTotalInvestment;
        setCalculatedPreMoneyFromPercentage(0); // Not applicable
        if (currentPreMoney > 0 && sharesBeforeNewInvestors > 0 && currentTotalInvestment > 0) {
            currentSharesToIssue = Math.round((currentTotalInvestment * sharesBeforeNewInvestors) / currentPreMoney);
        }
    } else if (valuationType === 'percentage') {
        const percAcquiredDecimal = (Number(percentageAcquired) || 0) / 100;
        if (percAcquiredDecimal > 0 && percAcquiredDecimal < 1 && currentTotalInvestment > 0) {
            currentPostMoney = currentTotalInvestment / percAcquiredDecimal;
            currentPreMoney = currentPostMoney - currentTotalInvestment;
            setCalculatedPreMoneyFromPercentage(currentPreMoney);
            if (sharesBeforeNewInvestors > 0) {
                 // S_new = (Y * S_existing) / (1 - Y)
                currentSharesToIssue = Math.round((percAcquiredDecimal * sharesBeforeNewInvestors) / (1 - percAcquiredDecimal));
            }
        } else {
             currentPreMoney = 0; // cannot determine if % or investment is zero
        }
    }
    
    currentSharePrice = currentSharesToIssue > 0 ? currentTotalInvestment / currentSharesToIssue : 0;

    setCalculatedPostMoney(currentPostMoney);
    setSharesToIssue(currentSharesToIssue);
    setSharePrice(currentSharePrice);

  }, [investors, valuationType, preMoneyValuation, percentageAcquired, totalExistingShares, optionPoolIncrease]);

  useEffect(() => {
    calculateDerivedValues();
  }, [calculateDerivedValues]);


  const handleInvestorChange = (index: number, field: 'name' | 'investmentAmount', value: string | number) => {
    const newInvestors = [...investors];
    if (field === 'investmentAmount') {
      newInvestors[index][field] = Math.max(0, Number(value) || 0);
    } else {
      newInvestors[index][field] = value as string;
    }
    setInvestors(newInvestors);
  };

  const addInvestorField = () => {
    setInvestors([...investors, { tempId: nanoid(5), name: '', investmentAmount: 0 }]);
  };

  const removeInvestorField = (index: number) => {
    if (investors.length > 1) {
      setInvestors(investors.filter((_, i) => i !== index));
    } else {
      // Clear the fields of the last investor instead of removing the row
      setInvestors([{ tempId: nanoid(5), name: '', investmentAmount: 0 }]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (existingShareholdersCount === 0 && totalExistingShares === 0) {
        if (!window.confirm("Warning: There are no existing shareholders (excluding ESOP if it's 0). Are you sure you want to proceed? This round will effectively set the initial valuation based on the first investment.")) {
            return;
        }
    }
    if (totalInvestment <= 0) {
        alert("Total investment amount must be greater than zero.");
        return;
    }
    if (valuationType === 'preMoney' && preMoneyValuation <= 0) {
        alert("Pre-money valuation must be greater than zero for this valuation type.");
        return;
    }
    if (valuationType === 'percentage' && (percentageAcquired <= 0 || percentageAcquired >= 100)) {
        alert("Percentage acquired must be between 0 and 100 (exclusive) for this valuation type.");
        return;
    }
     if (sharesToIssue <= 0) {
        alert("Calculated shares to issue is zero or negative. Please check valuation and investment inputs.");
        return;
    }


    onSubmit({
      name,
      date,
      valuationType,
      preMoneyValuation: valuationType === 'preMoney' ? preMoneyValuation : calculatedPreMoneyFromPercentage,
      percentageAcquired: valuationType === 'percentage' ? percentageAcquired : (calculatedPostMoney > 0 ? (totalInvestment / calculatedPostMoney * 100) : 0),
      investors,
      optionPoolIncrease,
    });
  };
  
  const inputBaseClass = "w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white";
  const inputTextClass = "text-slate-800 placeholder-slate-500";
  const readOnlyInputClass = "w-full p-3 border border-slate-300 rounded-lg shadow-sm bg-slate-200 text-slate-800 cursor-not-allowed";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="roundName" className={labelClass}>Round Name</label>
          <input type="text" id="roundName" value={name} onChange={e => setName(e.target.value)} required className={`${inputBaseClass} ${inputTextClass}`} placeholder="e.g., Seed Round, Series A"/>
        </div>
        <div>
          <label htmlFor="roundDate" className={labelClass}>Date</label>
          <input type="date" id="roundDate" value={date} onChange={e => setDate(e.target.value)} required className={`${inputBaseClass} ${inputTextClass}`}/>
        </div>
      </div>

      <div className="p-4 border border-indigo-200 rounded-lg bg-indigo-50/50">
        <h3 className="text-md font-semibold text-indigo-700 mb-3">Valuation & Investment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <label htmlFor="valuationType" className={labelClass}>Define Round By</label>
            <select id="valuationType" value={valuationType} onChange={e => setValuationType(e.target.value as 'preMoney' | 'percentage')} className={`${inputBaseClass} text-slate-800`}>
              <option value="preMoney">Pre-Money Valuation</option>
              <option value="percentage">Percentage Acquired by New Investors</option>
            </select>
          </div>
           <div> {/* Spacer or other element */} </div>

          {valuationType === 'preMoney' ? (
            <div>
              <label htmlFor="preMoneyValuation" className={labelClass}>Pre-Money Valuation ($)</label>
              <input type="number" id="preMoneyValuation" value={preMoneyValuation} onChange={e => setPreMoneyValuation(parseFloat(e.target.value) || 0)} min="0" step="any" className={`${inputBaseClass} ${inputTextClass}`} />
            </div>
          ) : (
            <div>
              <label htmlFor="percentageAcquired" className={labelClass}>Percentage Acquired by New Investors (%)</label>
              <input type="number" id="percentageAcquired" value={percentageAcquired} onChange={e => setPercentageAcquired(parseFloat(e.target.value) || 0)} min="0.01" max="99.99" step="any" className={`${inputBaseClass} ${inputTextClass}`} />
            </div>
          )}
           <div>
                <label className={labelClass}>Total Investment Amount ($)</label>
                <input type="text" value={`$${totalInvestment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} readOnly className={readOnlyInputClass} />
            </div>
        </div>
      </div>


      <div className="p-4 border border-slate-200 rounded-lg">
        <h3 className="text-md font-semibold text-slate-700 mb-3">Investors in this Round</h3>
        {investors.map((investor, index) => (
          <div key={investor.tempId} className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 mb-3 items-center p-3 rounded-md bg-slate-50/70 border border-slate-200/80">
            <input
              type="text"
              placeholder={`Investor ${index + 1} Name`}
              value={investor.name}
              onChange={e => handleInvestorChange(index, 'name', e.target.value)}
              required
              className={`${inputBaseClass} ${inputTextClass} md:col-span-2`}
            />
            <div className="flex items-center">
                <span className="text-slate-500 mr-1">$</span>
                <input
                type="number"
                placeholder="Amount"
                value={investor.investmentAmount}
                onChange={e => handleInvestorChange(index, 'investmentAmount', e.target.value)}
                min="0" step="any" required
                className={`${inputBaseClass} ${inputTextClass} flex-grow`}
                />
                <button type="button" onClick={() => removeInvestorField(index)} className="ml-2 text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-100 transition-colors" title="Remove Investor">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" /></svg>
                </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addInvestorField} className="mt-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
          Add Investor
        </button>
      </div>
      
      <div>
        <label htmlFor="optionPoolIncrease" className={labelClass}>New Class A Shares for Employee Option Pool (ESOP)</label>
        <input type="number" id="optionPoolIncrease" value={optionPoolIncrease} onChange={e => setOptionPoolIncrease(parseInt(e.target.value, 10) || 0)} min="0" className={`${inputBaseClass} ${inputTextClass}`} />
      </div>

      <div className="p-4 border-2 border-dashed border-indigo-300 rounded-lg bg-indigo-50/30 space-y-2 text-sm">
          <h3 className="text-md font-semibold text-indigo-700 mb-2">Calculated Round Impact (Approximate)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
            <p>Pre-Money: <span className="font-medium text-indigo-600">${(valuationType === 'preMoney' ? preMoneyValuation : calculatedPreMoneyFromPercentage).toLocaleString(undefined, {maximumFractionDigits:0})}</span></p>
            <p>Post-Money: <span className="font-medium text-indigo-600">${calculatedPostMoney.toLocaleString(undefined, {maximumFractionDigits:0})}</span></p>
            <p>Share Price: <span className="font-medium text-indigo-600">${sharePrice.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits: 4})}</span></p>
            <p className="col-span-full md:col-span-1">Shares to Issue: <span className="font-medium text-indigo-600">{sharesToIssue.toLocaleString(undefined, {maximumFractionDigits:0})}</span></p>
          </div>
           {sharesToIssue <= 0 && totalInvestment > 0 && <p className="text-xs text-amber-700 mt-1">Shares to issue is zero. Check pre-money valuation (if applicable) or ensure total existing shares is positive.</p>}
      </div>


      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          {initialData ? 'Preview Updated Round' : 'Preview Round'}
        </button>
      </div>
    </form>
  );
};

export default FundingRoundForm;