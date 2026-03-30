import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">{t('language')}:</span>
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 rounded text-xs ${i18n.language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('tr')}
        className={`px-2 py-1 rounded text-xs ${i18n.language === 'tr' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
      >
        TR
      </button>
    </div>
  );
}

