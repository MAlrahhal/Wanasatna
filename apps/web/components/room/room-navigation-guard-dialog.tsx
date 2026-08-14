'use client';

import { UiDialog } from '@/components/ui/dialog';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';

type RoomNavigationGuardDialogProps = {
  open: boolean;
  isLeaving: boolean;
  onStay: () => void;
  onLeaveAndContinue: () => void;
};

export function RoomNavigationGuardDialog({
  open,
  isLeaving,
  onStay,
  onLeaveAndContinue,
}: RoomNavigationGuardDialogProps) {
  return (
    <UiDialog
      open={open}
      title={SYSTEM_COPY.leaveConfirmTitle}
      description={SYSTEM_COPY.leaveConfirmBody}
      variant="warning"
      cancelLabel={SYSTEM_COPY.cancel}
      confirmLabel={isLeaving ? SYSTEM_COPY.leaving : SYSTEM_COPY.leave}
      onClose={() => {
        if (!isLeaving) {
          onStay();
        }
      }}
      onConfirm={onLeaveAndContinue}
    />
  );
}
