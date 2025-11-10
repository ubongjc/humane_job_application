import { useEffect, useRef, useCallback } from "react";
import { useDebounce } from "./use-debounce";

interface AutosaveOptions {
  onSave: (data: any) => Promise<void>;
  delay?: number; // milliseconds
  enabled?: boolean;
}

/**
 * Auto-save hook that saves data after user stops typing
 * Prevents data loss and provides stress-free editing
 */
export function useAutosave<T>(data: T, options: AutosaveOptions) {
  const { onSave, delay = 3000, enabled = true } = options;
  const debouncedData = useDebounce(data, delay);
  const previousDataRef = useRef<T>(data);
  const isSavingRef = useRef(false);
  const lastSaveTimeRef = useRef<Date | null>(null);

  const save = useCallback(
    async (dataToSave: T) => {
      if (!enabled || isSavingRef.current) return;

      // Check if data actually changed
      if (JSON.stringify(dataToSave) === JSON.stringify(previousDataRef.current)) {
        return;
      }

      isSavingRef.current = true;

      try {
        await onSave(dataToSave);
        previousDataRef.current = dataToSave;
        lastSaveTimeRef.current = new Date();

        // Show success indicator (optional)
        const event = new CustomEvent("autosave-success", {
          detail: { timestamp: lastSaveTimeRef.current },
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error("Autosave failed:", error);

        // Show error indicator
        const event = new CustomEvent("autosave-error", {
          detail: { error },
        });
        window.dispatchEvent(event);
      } finally {
        isSavingRef.current = false;
      }
    },
    [enabled, onSave]
  );

  // Auto-save when debounced data changes
  useEffect(() => {
    if (enabled && debouncedData !== previousDataRef.current) {
      save(debouncedData);
    }
  }, [debouncedData, enabled, save]);

  // Save on unmount (window close, navigation)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (data !== previousDataRef.current) {
        // Use navigator.sendBeacon for reliable sending during unload
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        navigator.sendBeacon("/api/autosave", blob);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Final save on component unmount
      if (data !== previousDataRef.current) {
        save(data);
      }
    };
  }, [data, save]);

  return {
    lastSaveTime: lastSaveTimeRef.current,
    isSaving: isSavingRef.current,
    forceSave: () => save(data),
  };
}
