export type SupportedLocale = 'en' | 'es' | 'fr' | 'de';

export const SUPPORTED_LOCALES: Array<{ code: SupportedLocale; label: string; nativeName: string }> = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' }
];

const LOCALE_STORAGE_KEY = 'caloriq_locale';

export type TranslationKey =
  | 'nav.diary'
  | 'nav.plan'
  | 'nav.reports'
  | 'nav.community'
  | 'nav.me'
  | 'common.skipToContent'
  | 'common.backToTop'
  | 'common.loading'
  | 'common.save'
  | 'common.cancel'
  | 'common.close'
  | 'common.help'
  | 'diary.remaining'
  | 'diary.eaten'
  | 'diary.burned'
  | 'diary.water'
  | 'diary.addFood'
  | 'diary.exercise'
  | 'macros.carbs'
  | 'macros.fat'
  | 'macros.protein'
  | 'me.language'
  | 'me.restoreBackup'
  | 'me.exportBackup'
  | 'me.reportBug'
  | 'me.whatsNew'
  | 'me.sessions'
  | 'me.signOutAll'
  | 'me.changeEmail'
  | 'me.changePassword'
  | 'me.version'
  | 'error.404Title'
  | 'error.404Body'
  | 'error.500Body'
  | 'pwa.installTitle'
  | 'pwa.installBody'
  | 'pwa.installBtn'
  | 'cookie.bannerText'
  | 'cookie.accept'
  | 'cookie.decline'
  | 'ccpa.doNotSell';

export const STRINGS: Record<SupportedLocale, Record<TranslationKey, string>> = {
  en: {
    'nav.diary': 'Diary',
    'nav.plan': 'Plan',
    'nav.reports': 'Reports',
    'nav.community': 'Community',
    'nav.me': 'Me',
    'common.skipToContent': 'Skip to main content',
    'common.backToTop': 'Back to top',
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.help': 'Screen Help & Tips',
    'diary.remaining': 'Remaining',
    'diary.eaten': 'Eaten',
    'diary.burned': 'Burned',
    'diary.water': 'Water',
    'diary.addFood': 'Add Food',
    'diary.exercise': 'Exercise',
    'macros.carbs': 'Carbs',
    'macros.fat': 'Fat',
    'macros.protein': 'Protein',
    'me.language': 'Language',
    'me.restoreBackup': 'Restore from backup',
    'me.exportBackup': 'Export all data (GDPR JSON)',
    'me.reportBug': 'Report a bug',
    'me.whatsNew': "What's new",
    'me.sessions': 'Active Sessions & Devices',
    'me.signOutAll': 'Sign out all devices',
    'me.changeEmail': 'Change email address',
    'me.changePassword': 'Change password',
    'me.version': 'Calory v1.0.0',
    'error.404Title': "This page doesn't exist.",
    'error.404Body': "This page doesn't exist. Back to your diary.",
    'error.500Body': "Something's wrong on our end. Try again in a minute.",
    'pwa.installTitle': 'Install Calory',
    'pwa.installBody': 'Add Calory to your home screen for instant offline access and full-screen tracking.',
    'pwa.installBtn': 'Install Calory',
    'cookie.bannerText': 'We use essential local storage for sign-in and optional privacy-friendly analytics (no tracking cookies or health data).',
    'cookie.accept': 'Accept',
    'cookie.decline': 'Decline',
    'ccpa.doNotSell': 'Do not sell my personal information (CCPA)'
  },
  es: {
    'nav.diary': 'Diario',
    'nav.plan': 'Plan',
    'nav.reports': 'Informes',
    'nav.community': 'Comunidad',
    'nav.me': 'Perfil',
    'common.skipToContent': 'Saltar al contenido principal',
    'common.backToTop': 'Volver arriba',
    'common.loading': 'Cargando...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.close': 'Cerrar',
    'common.help': 'Ayuda y consejos',
    'diary.remaining': 'Restantes',
    'diary.eaten': 'Consumidas',
    'diary.burned': 'Quemadas',
    'diary.water': 'Agua',
    'diary.addFood': 'Añadir comida',
    'diary.exercise': 'Ejercicio',
    'macros.carbs': 'Carbohidratos',
    'macros.fat': 'Grasas',
    'macros.protein': 'Proteína',
    'me.language': 'Idioma',
    'me.restoreBackup': 'Restaurar desde copia de seguridad',
    'me.exportBackup': 'Exportar todos los datos (JSON RGPD)',
    'me.reportBug': 'Informar de un error',
    'me.whatsNew': 'Novedades',
    'me.sessions': 'Sesiones y dispositivos activos',
    'me.signOutAll': 'Cerrar sesión en todos los dispositivos',
    'me.changeEmail': 'Cambiar correo electrónico',
    'me.changePassword': 'Cambiar contraseña',
    'me.version': 'Calory v1.0.0',
    'error.404Title': 'Esta página no existe.',
    'error.404Body': 'Esta página no existe. Volver a tu diario.',
    'error.500Body': 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un minuto.',
    'pwa.installTitle': 'Instalar Calory',
    'pwa.installBody': 'Añade Calory a tu pantalla de inicio para acceso sin conexión y pantalla completa.',
    'pwa.installBtn': 'Instalar Calory',
    'cookie.bannerText': 'Usamos almacenamiento local esencial para iniciar sesión y analíticas privadas opcionales (sin cookies de rastreo ni datos de salud).',
    'cookie.accept': 'Aceptar',
    'cookie.decline': 'Rechazar',
    'ccpa.doNotSell': 'No vender mi información personal (CCPA)'
  },
  fr: {
    'nav.diary': 'Journal',
    'nav.plan': 'Plan',
    'nav.reports': 'Rapports',
    'nav.community': 'Communauté',
    'nav.me': 'Moi',
    'common.skipToContent': 'Aller au contenu principal',
    'common.backToTop': 'Haut de page',
    'common.loading': 'Chargement...',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.close': 'Fermer',
    'common.help': 'Aide et conseils',
    'diary.remaining': 'Restantes',
    'diary.eaten': 'Consommées',
    'diary.burned': 'Brûlées',
    'diary.water': 'Eau',
    'diary.addFood': 'Ajouter un aliment',
    'diary.exercise': 'Exercice',
    'macros.carbs': 'Glucides',
    'macros.fat': 'Lipides',
    'macros.protein': 'Protéines',
    'me.language': 'Langue',
    'me.restoreBackup': 'Restaurer depuis une sauvegarde',
    'me.exportBackup': 'Exporter toutes les données (JSON RGPD)',
    'me.reportBug': 'Signaler un bug',
    'me.whatsNew': 'Nouveautés',
    'me.sessions': 'Sessions et appareils actifs',
    'me.signOutAll': 'Se déconnecter de tous les appareils',
    'me.changeEmail': "Changer d'adresse e-mail",
    'me.changePassword': 'Changer le mot de passe',
    'me.version': 'Calory v1.0.0',
    'error.404Title': "Cette page n'existe pas.",
    'error.404Body': "Cette page n'existe pas. Retour à votre journal.",
    'error.500Body': 'Un problème est survenu de notre côté. Réessayez dans une minute.',
    'pwa.installTitle': 'Installer Calory',
    'pwa.installBody': "Ajoutez Calory à votre écran d'accueil pour un suivi hors ligne en plein écran.",
    'pwa.installBtn': 'Installer Calory',
    'cookie.bannerText': 'Nous utilisons le stockage local essentiel pour la connexion et des analyses respectueuses de la vie privée (sans cookies de suivi).',
    'cookie.accept': 'Accepter',
    'cookie.decline': 'Refuser',
    'ccpa.doNotSell': 'Ne pas vendre mes données personnelles (CCPA)'
  },
  de: {
    'nav.diary': 'Tagebuch',
    'nav.plan': 'Plan',
    'nav.reports': 'Berichte',
    'nav.community': 'Community',
    'nav.me': 'Ich',
    'common.skipToContent': 'Zum Hauptinhalt springen',
    'common.backToTop': 'Nach oben',
    'common.loading': 'Wird geladen...',
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.close': 'Schließen',
    'common.help': 'Hilfe & Tipps',
    'diary.remaining': 'Verbleibend',
    'diary.eaten': 'Gegessen',
    'diary.burned': 'Verbrannt',
    'diary.water': 'Wasser',
    'diary.addFood': 'Essen hinzufügen',
    'diary.exercise': 'Training',
    'macros.carbs': 'Kohlenhydrate',
    'macros.fat': 'Fett',
    'macros.protein': 'Eiweiß',
    'me.language': 'Sprache',
    'me.restoreBackup': 'Aus Backup wiederherstellen',
    'me.exportBackup': 'Alle Daten exportieren (DSGVO JSON)',
    'me.reportBug': 'Fehler melden',
    'me.whatsNew': 'Neuigkeiten',
    'me.sessions': 'Aktive Sitzungen & Geräte',
    'me.signOutAll': 'Auf allen Geräten abmelden',
    'me.changeEmail': 'E-Mail-Adresse ändern',
    'me.changePassword': 'Passwort ändern',
    'me.version': 'Calory v1.0.0',
    'error.404Title': 'Diese Seite existiert nicht.',
    'error.404Body': 'Diese Seite existiert nicht. Zurück zu deinem Tagebuch.',
    'error.500Body': 'Auf unserer Seite ist etwas schiefgelaufen. Versuche es in einer Minute erneut.',
    'pwa.installTitle': 'Calory installieren',
    'pwa.installBody': 'Füge Calory zu deinem Startbildschirm hinzu für Offline-Nutzung im Vollbildmodus.',
    'pwa.installBtn': 'Calory installieren',
    'cookie.bannerText': 'Wir verwenden lokalen Speicher für die Anmeldung und optionale datenschutzfreundliche Analysen (keine Tracking-Cookies).',
    'cookie.accept': 'Akzeptieren',
    'cookie.decline': 'Ablehnen',
    'ccpa.doNotSell': 'Meine Daten nicht verkaufen (CCPA)'
  }
};

export function detectDeviceLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale | null;
  if (stored && (stored === 'en' || stored === 'es' || stored === 'fr' || stored === 'de')) {
    return stored;
  }
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('de')) return 'de';
  return 'en';
}

export function setAppLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.documentElement.setAttribute('lang', locale);
  window.dispatchEvent(new CustomEvent('caloriq-locale-change', { detail: locale }));
}

export const APP_VERSION = 'v1.0.0';
export type SupportedLanguage = SupportedLocale;

export function detectDefaultLanguage(): SupportedLocale {
  return detectDeviceLocale();
}

export function syncHtmlLangAttribute(lang?: SupportedLocale): SupportedLocale {
  const locale = lang || detectDeviceLocale();
  if (typeof window !== 'undefined' && lang) {
    localStorage.setItem(LOCALE_STORAGE_KEY, lang);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale);
  }
  return locale;
}

export function t(key: TranslationKey | 'diary' | 'fitness' | 'community' | 'plan' | 'reports' | 'me', locale?: SupportedLocale): string {
  const active = locale || detectDeviceLocale();
  const mappedKey: TranslationKey =
    key === 'diary'
      ? 'nav.diary'
      : key === 'fitness'
        ? 'diary.exercise'
        : key === 'community'
          ? 'nav.community'
          : key === 'plan'
            ? 'nav.plan'
            : key === 'reports'
              ? 'nav.reports'
              : key === 'me'
                ? 'nav.me'
                : key;
  return STRINGS[active]?.[mappedKey] || STRINGS.en[mappedKey] || String(key);
}

// #85 Use metric system by default outside the US. Imperial inside the US.
export function getDefaultUnitSystemForLocale(): 'metric' | 'imperial' {
  if (typeof navigator === 'undefined') return 'metric';
  const lang = (navigator.language || 'en-GB').toUpperCase();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (lang.includes('-US') || lang === 'EN-US' || tz.startsWith('America/New_York') || tz.startsWith('America/Chicago') || tz.startsWith('America/Denver') || tz.startsWith('America/Los_Angeles')) {
    return 'imperial';
  }
  return 'metric';
}

// #84 Format dates, numbers, and units based on the user's locale
export function formatLocaleDate(dateStrOrObj: string | Date, locale?: SupportedLocale): string {
  const active = locale || detectDeviceLocale();
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj + (dateStrOrObj.includes('T') ? '' : 'T00:00:00')) : dateStrOrObj;
  if (isNaN(d.getTime())) return String(dateStrOrObj);
  return new Intl.DateTimeFormat(active, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d);
}

export function formatLocaleNumber(value: number, maximumFractionDigits = 1, locale?: SupportedLocale): string {
  const active = locale || detectDeviceLocale();
  return new Intl.NumberFormat(active, { maximumFractionDigits }).format(value);
}

export function formatWeight(weightKg: number, unitSystem: 'metric' | 'imperial', locale?: SupportedLocale): string {
  if (unitSystem === 'imperial') {
    const lbs = Math.round(weightKg * 2.20462 * 10) / 10;
    return `${formatLocaleNumber(lbs, 1, locale)} lbs`;
  }
  return `${formatLocaleNumber(Math.round(weightKg * 10) / 10, 1, locale)} kg`;
}
