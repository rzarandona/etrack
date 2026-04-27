'use client';

import { ConfirmDeleteButton } from '@/lib/components/confirm-delete-button';
import { deleteEmployee } from '../actions';

export function DeleteEmployeeButton({ id, fullName }: { id: string; fullName: string }) {
  return (
    <ConfirmDeleteButton
      title={`Delete ${fullName}?`}
      message="This permanently removes the employee record and their photo/badge files. If scans reference this employee, the deletion will be blocked — use Deactivate instead."
      onDelete={() => deleteEmployee(id)}
      redirectTo="/employees"
    />
  );
}
