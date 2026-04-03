declare global {
  interface Window {
    __googleMapsPromise?: Promise<typeof google>;
    [key: string]: unknown;
  }
}

export function loadGoogleMapsApi(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps API can only load in the browser."));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (window.__googleMapsPromise) {
    return window.__googleMapsPromise;
  }

  window.__googleMapsPromise = new Promise<typeof google>((resolve, reject) => {
    const callbackName = `__initGoogleMaps_${Date.now()}`;
    const script = document.createElement("script");

    window[callbackName] = () => {
      resolve(window.google);
      delete window[callbackName];
    };

    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      reject(new Error("Failed to load Google Maps API."));
      delete window[callbackName];
      window.__googleMapsPromise = undefined;
    };

    document.head.appendChild(script);
  });

  return window.__googleMapsPromise;
}
