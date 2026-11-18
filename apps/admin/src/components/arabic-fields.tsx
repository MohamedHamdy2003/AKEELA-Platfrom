import type { ReactNode, FormEvent } from 'react';
import { FieldMessagesContext } from '@akeela/portal/ui';
import { arabicFieldMessages } from '../lib/arabic-fields';

function control(event: FormEvent<HTMLDivElement>) {
  const target = event.target;
  return target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
    ? target
    : null;
}
export function ArabicFields({ children }: { children: ReactNode }) {
  return (
    <FieldMessagesContext.Provider value={arabicFieldMessages}>
      <div
        lang="ar"
        dir="rtl"
        onInputCapture={(event) => control(event)?.setCustomValidity('')}
        onChangeCapture={(event) => control(event)?.setCustomValidity('')}
        onInvalidCapture={(event) => {
          const input = control(event);
          if (!input) return;
          input.setCustomValidity(
            input.validity.valueMissing
              ? 'هذا الحقل مطلوب.'
              : arabicFieldMessages(
                  input.name || ('type' in input ? input.type : ''),
                  ['invalid'],
                )[0]!,
          );
        }}
      >
        {children}
      </div>
    </FieldMessagesContext.Provider>
  );
}
