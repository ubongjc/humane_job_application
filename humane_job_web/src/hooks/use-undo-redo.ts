import { useState, useCallback, useEffect, useRef } from "react";

/**
 * 🔄 UNDO/REDO HOOK
 *
 * Eliminates fear of making mistakes! Users can undo/redo any changes.
 * Perfect for form editing, canvas operations, or any user input.
 *
 * Features:
 * - Cmd+Z to undo
 * - Cmd+Shift+Z to redo
 * - Configurable history limit
 * - Automatic state snapshots
 * - Works with any data type
 *
 * Example:
 * ```tsx
 * const {
 *   state,
 *   setState,
 *   undo,
 *   redo,
 *   canUndo,
 *   canRedo
 * } = useUndoRedo(initialText);
 *
 * // User types something
 * setState("new text");
 *
 * // Oops! Undo it
 * undo(); // Back to previous state
 * ```
 */

interface UseUndoRedoOptions {
  /**
   * Maximum number of history states to keep
   * @default 50
   */
  maxHistory?: number;

  /**
   * Enable keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
   * @default true
   */
  enableKeyboard?: boolean;

  /**
   * Callback when state changes
   */
  onChange?: (state: any) => void;
}

interface UseUndoRedoReturn<T> {
  /**
   * Current state
   */
  state: T;

  /**
   * Update state and add to history
   */
  setState: (newState: T | ((prev: T) => T)) => void;

  /**
   * Undo to previous state
   */
  undo: () => void;

  /**
   * Redo to next state
   */
  redo: () => void;

  /**
   * Whether we can undo
   */
  canUndo: boolean;

  /**
   * Whether we can redo
   */
  canRedo: boolean;

  /**
   * Clear all history
   */
  clearHistory: () => void;

  /**
   * Get history info
   */
  historyInfo: {
    past: number;
    future: number;
    total: number;
  };
}

export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions = {}
): UseUndoRedoReturn<T> {
  const { maxHistory = 50, enableKeyboard = true, onChange } = options;

  // History stacks
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);

  // Prevent keyboard events during input focus
  const isInputFocused = useRef(false);

  // Update state and record in history
  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setPresent((currentState) => {
        const nextState =
          typeof newState === "function"
            ? (newState as (prev: T) => T)(currentState)
            : newState;

        // Only add to history if state actually changed
        if (JSON.stringify(nextState) === JSON.stringify(currentState)) {
          return currentState;
        }

        // Add current state to past
        setPast((prev) => {
          const newPast = [...prev, currentState];
          // Limit history size
          if (newPast.length > maxHistory) {
            return newPast.slice(newPast.length - maxHistory);
          }
          return newPast;
        });

        // Clear future (can't redo after new change)
        setFuture([]);

        onChange?.(nextState);

        return nextState;
      });
    },
    [maxHistory, onChange]
  );

  // Undo
  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setPast(newPast);
    setFuture([present, ...future]);
    setPresent(previous);

    onChange?.(previous);
  }, [past, present, future, onChange]);

  // Redo
  const redo = useCallback(() => {
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    setPast([...past, present]);
    setFuture(newFuture);
    setPresent(next);

    onChange?.(next);
  }, [past, present, future, onChange]);

  // Clear history
  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+Z / Ctrl+Z: Undo
      if (modKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Cmd+Shift+Z / Ctrl+Shift+Z: Redo
      if (modKey && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }

      // Alternative: Cmd+Y / Ctrl+Y for Redo
      if (modKey && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, enableKeyboard]);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clearHistory,
    historyInfo: {
      past: past.length,
      future: future.length,
      total: past.length + future.length + 1,
    },
  };
}

/**
 * 🎨 UNDO/REDO FOR FORMS
 *
 * Specialized hook for form fields with debounced history.
 * Prevents creating history entry for every keystroke.
 *
 * Example:
 * ```tsx
 * const {
 *   value,
 *   setValue,
 *   undo,
 *   canUndo
 * } = useUndoRedoForm("", { debounceMs: 500 });
 *
 * <input
 *   value={value}
 *   onChange={(e) => setValue(e.target.value)}
 * />
 * ```
 */
interface UseUndoRedoFormOptions extends UseUndoRedoOptions {
  /**
   * Debounce time before adding to history (ms)
   * Prevents creating entry for every keystroke
   * @default 500
   */
  debounceMs?: number;
}

export function useUndoRedoForm<T>(
  initialState: T,
  options: UseUndoRedoFormOptions = {}
): UseUndoRedoReturn<T> {
  const { debounceMs = 500, ...undoOptions } = options;

  const undoRedo = useUndoRedo(initialState, undoOptions);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingStateRef = useRef<T>(initialState);

  // Debounced setState
  const debouncedSetState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Update pending state immediately (for display)
      const nextState =
        typeof newState === "function"
          ? (newState as (prev: T) => T)(pendingStateRef.current)
          : newState;
      pendingStateRef.current = nextState;

      // Update actual state after debounce
      timeoutRef.current = setTimeout(() => {
        undoRedo.setState(nextState);
      }, debounceMs);
    },
    [undoRedo, debounceMs]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    ...undoRedo,
    setState: debouncedSetState,
  };
}

/**
 * 🎯 UNDO/REDO TOOLBAR
 *
 * Ready-to-use toolbar component with undo/redo buttons.
 *
 * Example:
 * ```tsx
 * const undoRedo = useUndoRedo(initialState);
 *
 * return (
 *   <>
 *     <UndoRedoToolbar {...undoRedo} />
 *     <YourContent />
 *   </>
 * );
 * ```
 */
import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UndoRedoToolbarProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  className?: string;
}

export function UndoRedoToolbar({
  undo,
  redo,
  canUndo,
  canRedo,
  className = "",
}: UndoRedoToolbarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        size="sm"
        variant="ghost"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Cmd+Z)"
      >
        <Undo2 className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo2 className="w-4 h-4" />
      </Button>
      {canUndo && (
        <span className="text-xs text-gray-500 ml-2">
          Cmd+Z to undo
        </span>
      )}
    </div>
  );
}
