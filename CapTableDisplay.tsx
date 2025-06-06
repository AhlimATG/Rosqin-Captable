
import React from 'react';
import { CapTableSnapshot, ProcessedShareholder, ShareClass, ShareholderCategory } from './types';

interface CapTableDisplayProps {
  snapshot: CapTableSnapshot | null;
  title: string;
  isPreview?: boolean;
  onEditShareholder?: (shareholderId: string) => void;
  onDeleteShareholder?: (shareholderId: string) => void;
  isShareholderManagementEnabled?: boolean;
  isReadOnly?: boolean; // New prop
}

const CapTableDisplay: React.FC<CapTableDisplayProps> = ({
  snapshot,
  title,
  isPreview = false,
  onEditShareholder,
  onDeleteShareholder,
  isShareholderManagementEnabled = false,
  isReadOnly = false, // Default to false
}) => {
  if (!snapshot) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg text-center">
            <p className="text-slate-500 text-lg">No cap table data to display yet.</p>
            <p className="text-slate-400 mt-2">Start by adding shareholders or simulating a funding round.</p>
        </div>
    );
  }

  const showActionsColumn = isShareholderManagementEnabled && !isPreview && !isReadOnly;

  return (
    <div className={`bg-white p-4 sm:p-6 rounded-xl shadow-xl ${isPreview ? 'ring-2 ring-indigo-500' : ''}`}>
      <h2 className="text-2xl sm:text-3xl font-semibold text-indigo-700 mb-6 text-center sm:text-left">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-slate-700">Shareholder</th>
              <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-slate-700">Category</th>
              <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Class A</th>
              <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Class B</th>
              <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Total Shares</th>
              <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Ownership %</th>
              <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Voting Power</th>
              <th scope="col" className="px-4 py-3.5 text-right text-sm font-semibold text-slate-700">Voting %</th>
              {showActionsColumn && (
                <th scope="col" className="px-4 py-3.5 text-center text-sm font-semibold text-slate-700">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {snapshot.shareholders.map((sh: ProcessedShareholder) => (
              <tr key={sh.id} className="hover:bg-slate-50/70 transition-colors duration-150 group">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-indigo-600">{sh.name}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{sh.category}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{sh.holdings.find(h => h.shareClass === ShareClass.A)?.count.toLocaleString() || '0'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{sh.holdings.find(h => h.shareClass === ShareClass.B)?.count.toLocaleString() || '0'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-semibold text-right">{sh.totalShares.toLocaleString()}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{sh.ownershipPercentage.toFixed(2)}%</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{sh.votingPower.toLocaleString()}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{sh.votingPercentage.toFixed(2)}%</td>
                {showActionsColumn && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {sh.category !== ShareholderCategory.EMPLOYEE_POOL && ( 
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center space-x-2">
                        <button 
                            onClick={() => onEditShareholder && onEditShareholder(sh.id)} 
                            className="text-indigo-600 hover:text-indigo-800 p-1" 
                            title="Edit Shareholder">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
                        </button>
                        <button 
                            onClick={() => onDeleteShareholder && onDeleteShareholder(sh.id)} 
                            className="text-red-500 hover:text-red-700 p-1" 
                            title="Delete Shareholder">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.34.297A1.75 1.75 0 002.25 6v1.75a.75.75 0 001.5 0V6.75A.25.25 0 014 6.5h12a.25.25 0 01.25.25v7.5A.25.25 0 0116 14.5h-1.75a.75.75 0 000 1.5H16A1.75 1.75 0 0017.75 14.25v-7.5A1.75 1.75 0 0016 5h-.25a.75.75 0 00-.75-.75h-2a.75.75 0 00-.75.75H12a.75.75 0 00-.75.75V5h-.69c-.76-.12-1.545-.22-2.34-.297V3.75A2.75 2.75 0 008.75 1zM10 6.5a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6zm2.5 0a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6z" clipRule="evenodd" /></svg>
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-300">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-left text-sm font-semibold text-slate-800">Totals</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">{snapshot.totalClassAShares.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">{snapshot.totalClassBShares.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">{snapshot.totalSharesOverall.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">100.00%</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">{snapshot.totalVotingPower.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">100.00%</td>
              {showActionsColumn && <td className="px-4 py-3"></td>}
            </tr>
          </tfoot>
        </table>
      </div>
       <div className="mt-6 p-4 bg-slate-50 rounded-lg text-sm border border-slate-200">
            <h4 className="font-semibold text-indigo-700 mb-2">Summary:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <p className="text-slate-600">Total Class A Shares: <span className="font-semibold text-sky-700">{snapshot.totalClassAShares.toLocaleString()}</span></p>
                <p className="text-slate-600">Total Class B Shares: <span className="font-semibold text-sky-700">{snapshot.totalClassBShares.toLocaleString()}</span></p>
                <p className="text-slate-600">Total Shares Overall: <span className="font-semibold text-sky-700">{snapshot.totalSharesOverall.toLocaleString()}</span></p>
                <p className="text-slate-600">Total Voting Power: <span className="font-semibold text-sky-700">{snapshot.totalVotingPower.toLocaleString()}</span></p>
                {snapshot.optionPool.totalAllocated > 0 && (
                    <p className="text-slate-600 col-span-full sm:col-span-1">ESOP (Class A): <span className="font-semibold text-sky-700">{snapshot.optionPool.totalAllocated.toLocaleString()}</span> ({snapshot.optionPool.percentageOfTotal.toFixed(2)}%)</p>
                )}
            </div>
        </div>
    </div>
  );
};

export default CapTableDisplay;
