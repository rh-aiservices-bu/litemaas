import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      nav: {
        home: 'Home',
        models: 'Models',
        subscriptions: 'Subscriptions',
        apiKeys: 'API Keys',
        usage: 'Usage',
        settings: 'Settings',
      },
      // Page titles
      pages: {
        home: {
          title: 'Welcome to LiteMaaS',
          subtitle: 'Your Model as a Service platform for accessing and managing AI models.',
        },
        models: {
          title: 'Available Models',
          noModels: 'No models available yet',
          description: 'Model discovery and subscription functionality coming soon.',
        },
        subscriptions: {
          title: 'Model Subscriptions',
        },
        apiKeys: {
          title: 'API Keys',
        },
        usage: {
          title: 'Usage Analytics',
        },
        settings: {
          title: 'Settings',
        },
      },
      // UI components
      ui: {
        theme: {
          light: 'Light',
          dark: 'Dark',
          toggle: 'Toggle theme',
        },
        language: {
          selector: 'Language',
          english: 'English',
          spanish: 'Español',
          french: 'Français',
        },
        notifications: {
          title: 'Notifications',
          markRead: 'Mark as read',
          clear: 'Clear all',
          empty: 'No notifications',
        },
        actions: {
          logout: 'Logout',
          login: 'Login with OpenShift',
          browse: 'Browse',
          refresh: 'Refresh Page',
          tryAgain: 'Try Again',
        },
        errors: {
          somethingWrong: 'Something went wrong',
          tryRefresh:
            "We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.",
        },
      },
    },
  },
  es: {
    translation: {
      nav: {
        home: 'Inicio',
        models: 'Modelos',
        subscriptions: 'Suscripciones',
        apiKeys: 'Claves API',
        usage: 'Uso',
        settings: 'Configuración',
      },
      pages: {
        home: {
          title: 'Bienvenido a LiteMaaS',
          subtitle: 'Tu plataforma de Modelo como Servicio para acceder y gestionar modelos de IA.',
        },
        models: {
          title: 'Modelos Disponibles',
          noModels: 'No hay modelos disponibles aún',
          description:
            'El descubrimiento de modelos y la funcionalidad de suscripción estarán disponibles pronto.',
        },
      },
      ui: {
        theme: {
          light: 'Claro',
          dark: 'Oscuro',
          toggle: 'Cambiar tema',
        },
        language: {
          selector: 'Idioma',
          english: 'English',
          spanish: 'Español',
          french: 'Français',
        },
        notifications: {
          title: 'Notificaciones',
          markRead: 'Marcar como leído',
          clear: 'Limpiar todo',
          empty: 'Sin notificaciones',
        },
        actions: {
          logout: 'Cerrar sesión',
          login: 'Iniciar sesión con OpenShift',
          browse: 'Explorar',
          refresh: 'Refrescar página',
          tryAgain: 'Intentar de nuevo',
        },
        errors: {
          somethingWrong: 'Algo salió mal',
          tryRefresh:
            'Lo sentimos, pero algo inesperado ocurrió. Por favor intenta refrescar la página o contacta soporte si el problema persiste.',
        },
      },
    },
  },
  fr: {
    translation: {
      nav: {
        home: 'Accueil',
        models: 'Modèles',
        subscriptions: 'Abonnements',
        apiKeys: 'Clés API',
        usage: 'Utilisation',
        settings: 'Paramètres',
      },
      pages: {
        home: {
          title: 'Bienvenue dans LiteMaaS',
          subtitle:
            'Votre plateforme de Modèle en tant que Service pour accéder et gérer les modèles IA.',
        },
        models: {
          title: 'Modèles Disponibles',
          noModels: 'Aucun modèle disponible pour le moment',
          description:
            "La découverte de modèles et la fonctionnalité d'abonnement arrivent bientôt.",
        },
      },
      ui: {
        theme: {
          light: 'Clair',
          dark: 'Sombre',
          toggle: 'Basculer le thème',
        },
        language: {
          selector: 'Langue',
          english: 'English',
          spanish: 'Español',
          french: 'Français',
        },
        notifications: {
          title: 'Notifications',
          markRead: 'Marquer comme lu',
          clear: 'Tout effacer',
          empty: 'Aucune notification',
        },
        actions: {
          logout: 'Se déconnecter',
          login: 'Se connecter avec OpenShift',
          browse: 'Parcourir',
          refresh: 'Actualiser la page',
          tryAgain: 'Réessayer',
        },
        errors: {
          somethingWrong: "Quelque chose s'est mal passé",
          tryRefresh:
            "Nous sommes désolés, mais quelque chose d'inattendu s'est produit. Veuillez essayer d'actualiser la page ou contacter le support si le problème persiste.",
        },
      },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: 'en', // Default language
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;
