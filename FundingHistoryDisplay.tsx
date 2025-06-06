
import React from 'react';
import { FundingRound } from './types';

interface FundingHistoryDisplayProps {
  rounds: FundingRound[];
  onEdit: (roundId: string) => void;
  onDelete: (roundId: string) => void;
  isReadOnly?: boolean; // New prop
}

const FundingHistoryDisplay: React.FC<FundingHistoryDisplayProps> = ({ rounds, onEdit, onDelete, isReadOnly = false }) => {
  if (rounds.length === 0) {
    return <p className="text-slate-500 text-center py-4">No funding rounds recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-slate-700">Date</th>
            <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-slate-700">Round Name</th>
            <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Investment ($)</th>
            <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Share Price ($)</th>
            <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Post-Money Val. ($)</th>
            <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">ESOP Increase</th>
            <th scope="col" className="px-4 py-3.5 text-center text-sm font-semibold text-slate-700">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {rounds.map((round, index) => (
            <tr key={round.id} className="hover:bg-slate-50/70 transition-colors duration-150 group">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{new Date(round.date).toLocaleDateString()}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-indigo-600">{round.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{round.investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{round.sharePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{round.postMoneyValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{(round.optionPoolIncreaseShares || 0).toLocaleString()}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                {!isReadOnly && index === rounds.length - 1 && ( 
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center space-x-2">
                    <button 
                        onClick={() => onEdit(round.id)} 
                        className="text-indigo-600 hover:text-indigo-800 p-1" 
                        title="Edit Latest Round">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
                    </button>
                    <button 
                        onClick={() => onDelete(round.id)} 
                        className="text-red-500 hover:text-red-700 p-1" 
                        title="Delete Latest Round">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.34.297A1.75 1.75 0 002.25 6v1.75a.75.75 0 001.5 0V6.75A.25.25 0 014 6.5h12a.25.25 0 01.25.25v7.5A.25.25 0 0116 14.5h-1.75a.75.75 0 000 1.5H16A1.75 1.75 0 0017.75 14.25v-7.5A1.75 1.75 0 0016 5h-.25a.75.75 0 00-.75-.75h-2a.75.75 0 00-.75.75H12a.75.75 0 00-.75.75V5h-.69c-.76-.12-1.545-.22-2.34-.297V3.75A2.75 2.75 0 008.75 1zM10 6.5a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6zm2.5 0a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                )}
                 {(isReadOnly || index !== rounds.length - 1) && (
                     <span className="text-xs text-slate-400">History</span>
                 )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FundingHistoryDisplay;
