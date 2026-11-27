import { Languages } from 'lucide-react';

import { languageOptions } from '@sarwa/core';
import { useAdminI18n } from '@sarwa/core/admin';
import {
  IconButton,
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from '@sarwa/ui';

export function LanguageMenu({ className }: { className?: string }) {
  const { t, locale, setLocale } = useAdminI18n();
  const languages = languageOptions({ t });
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={t.settings.language} className={className}>
          <Languages aria-hidden className="size-5" />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{t.settings.language}</MenuLabel>
        <MenuRadioGroup
          value={locale}
          onValueChange={(value) => {
            const option = languages.find((o) => o.value === value);
            if (option) setLocale(option.value);
          }}
        >
          {languages.map((option) => (
            <MenuRadioItem key={option.value} value={option.value} lang={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
