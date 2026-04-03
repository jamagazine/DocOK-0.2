import { useCallback } from 'react';
import { useData } from '../context/DataContext';

export function useTableEditor(stage: 'spec' | 'invoice' | 'estimate') {
  const { handleRowChange } = useData();

  // Wrapper for handleRowChange to encapsulate table cell edits
  const handleCellUpdate = useCallback((rowId: string, field: string, value: any) => {
    handleRowChange(stage, rowId, field, value);
  }, [handleRowChange, stage]);

  const addRow = useCallback(() => {
    // TODO: Implement explicit logic for adding new rows if needed
  }, []);

  const deleteRow = useCallback((rowId: string) => {
    // TODO: Implement explicit row deletion logic
  }, []);

  const toggleRowType = useCallback((rowId: string) => {
    // TODO: Implement ITEM <-> LOCATION toggling logic
  }, []);

  const validateData = useCallback((rowId: string) => {
    // TODO: Implement math_error parsing/validation logic
  }, []);

  return {
    handleCellUpdate,
    addRow,
    deleteRow,
    toggleRowType,
    validateData
  };
}
