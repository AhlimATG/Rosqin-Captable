import React, { useState, useEffect } from 'react';
import { Shareholder, NewShareholderInput, ShareholderCategory, ShareClass } from './types';

interface ShareholderFormProps {
  onSubmit: (shareholderData: NewShareholderInput) => void;
  onCancel: () => void;
  initialData?: Shareholder | null;
}

const ShareholderForm: React.FC<ShareholderFormProps> = ({ onSubmit, onCancel, initialData }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ShareholderCategory>(ShareholderCategory.INVESTOR);
  const [sharesClassA, setSharesClassA] = useState<number>(0);
  const [sharesClassB, setSharesClassB] = useState<number>(0);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCategory(initialData.category);
      setSharesClassA(initialData.sharesClassA || 0);
      setSharesClassB(initialData.sharesClassB || 0);
    } else {
      setName('');
      setCategory(ShareholderCategory.INVESTOR);
      setSharesClassA(0);
      setSharesClassB(0);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (category === ShareholderCategory.FOUNDER && sharesClassB <= 0 && sharesClassA <=0) {
        alert("Founders must hold shares (typically Class B, or Class A).");
        return;
    }
    if (category !== ShareholderCategory.FOUNDER && sharesClassB > 0) {
        alert("Class B shares are typically reserved for Founders only. Please assign Class A shares or change category to Founder.");
        return;
    }
     if (sharesClassA < 0 || sharesClassB < 0) {
        alert("Share counts cannot be negative.");
        return;
    }
    if (sharesClassA === 0 && sharesClassB === 0) {
        alert("Shareholder must have some shares.");
        return;
    }

    onSubmit({ name, category, sharesClassA, sharesClassB });
  };

  const isFounder = category === ShareholderCategory.FOUNDER;
  const inputBaseClass = "w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white";
  const inputTextClass = "text-slate-800 placeholder-slate-500";


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="shareholderName" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
        <input
          type="text"
          id="shareholderName"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className={`${inputBaseClass} ${inputTextClass}`}
          placeholder="e.g., Alice Wonderland"
        />
      </div>
      <div>
        <label htmlFor="shareholderCategory" className="block text-sm font-medium text-slate-700 mb-1">Category</label>
        <select
          id="shareholderCategory"
          value={category}
          onChange={e => {
            const newCategory = e.target.value as ShareholderCategory;
            setCategory(newCategory);
            // Logic to clear Class B shares if not a founder
            if (newCategory !== ShareholderCategory.FOUNDER) {
              setSharesClassB(0);
            }
          }}
          className={`${inputBaseClass} text-slate-800`}
        >
          {Object.values(ShareholderCategory)
            .filter(cat => cat !== ShareholderCategory.EMPLOYEE_POOL) // ESOP managed by system
            .map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      
      <div>
        <label htmlFor="sharesClassA" className="block text-sm font-medium text-slate-700 mb-1">
          Shares (Class A - {VOTES_PER_SHARE[ShareClass.A]} vote/share)
        </label>
        <input
          type="number"
          id="sharesClassA"
          value={sharesClassA}
          onChange={e => setSharesClassA(Math.max(0, parseInt(e.target.value, 10) || 0))}
          min="0"
          className={`${inputBaseClass} ${inputTextClass}`}
        />
      </div>

      {isFounder && (
        <div>
          <label htmlFor="sharesClassB" className="block text-sm font-medium text-slate-700 mb-1">
            Shares (Class B - {VOTES_PER_SHARE[ShareClass.B]} votes/share, Founders Only)
          </label>
          <input
            type="number"
            id="sharesClassB"
            value={sharesClassB}
            onChange={e => setSharesClassB(Math.max(0, parseInt(e.target.value, 10) || 0))}
            min="0"
            className={`${inputBaseClass} ${inputTextClass}`}
          />
        </div>
      )}
      {!isFounder && sharesClassB > 0 && (
         <p className="text-xs text-red-600">Class B shares are automatically set to 0 for non-founders.</p>
      )}


      <div className="flex justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          {initialData ? 'Save Changes' : 'Add Shareholder'}
        </button>
      </div>
    </form>
  );
};

// Need to define VOTES_PER_SHARE if not imported from constants, or pass as prop.
// Assuming it's available in scope (e.g. from constants.ts)
const VOTES_PER_SHARE: Record<ShareClass, number> = {
  [ShareClass.A]: 1,
  [ShareClass.B]: 10,
};

export default ShareholderForm;