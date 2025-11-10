import { useState, useCallback, useRef } from "react";

/**
 * 🚀 OPTIMISTIC UI HOOK
 *
 * Makes the app feel INSTANT by updating UI before server responds.
 * Automatically rolls back on error. Zero stress for users.
 *
 * Example:
 * ```tsx
 * const { data, updateOptimistic, isReverting } = useOptimistic(initialJobs);
 *
 * const handleCreate = async (newJob) => {
 *   await updateOptimistic(
 *     (current) => [...current, newJob], // Optimistic update
 *     () => api.createJob(newJob)        // Actual API call
 *   );
 * };
 * ```
 */

interface OptimisticOptions<T> {
  /**
   * Called when update succeeds
   */
  onSuccess?: (result: T) => void;

  /**
   * Called when update fails (before rollback)
   */
  onError?: (error: Error) => void;

  /**
   * Delay before reverting on error (ms)
   * Useful for showing error toast before UI reverts
   */
  revertDelay?: number;
}

interface UseOptimisticReturn<T> {
  /**
   * Current data (with optimistic updates applied)
   */
  data: T;

  /**
   * Perform an optimistic update
   * @param optimisticFn Function that returns the optimistic state
   * @param actualFn Async function that performs the actual operation
   * @param options Optional callbacks and settings
   */
  updateOptimistic: <R = any>(
    optimisticFn: (current: T) => T,
    actualFn: () => Promise<R>,
    options?: OptimisticOptions<R>
  ) => Promise<R>;

  /**
   * Whether an update is currently in progress
   */
  isPending: boolean;

  /**
   * Whether we're currently reverting after an error
   */
  isReverting: boolean;

  /**
   * Manually update the data (useful for external updates)
   */
  setData: (newData: T) => void;
}

export function useOptimistic<T>(initialData: T): UseOptimisticReturn<T> {
  const [data, setData] = useState<T>(initialData);
  const [isPending, setIsPending] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Store previous state for rollback
  const previousDataRef = useRef<T>(initialData);

  const updateOptimistic = useCallback(
    async <R = any>(
      optimisticFn: (current: T) => T,
      actualFn: () => Promise<R>,
      options: OptimisticOptions<R> = {}
    ): Promise<R> => {
      const { onSuccess, onError, revertDelay = 300 } = options;

      // Store current state for potential rollback
      previousDataRef.current = data;

      // Apply optimistic update immediately
      const optimisticData = optimisticFn(data);
      setData(optimisticData);
      setIsPending(true);

      try {
        // Perform actual operation
        const result = await actualFn();

        // Success! Keep the optimistic update
        setIsPending(false);
        onSuccess?.(result);

        return result;
      } catch (error) {
        // Failure! Revert to previous state
        setIsPending(false);
        setIsReverting(true);

        onError?.(error as Error);

        // Optional delay before reverting (so user sees error toast)
        if (revertDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, revertDelay));
        }

        // Rollback
        setData(previousDataRef.current);
        setIsReverting(false);

        throw error; // Re-throw so caller can handle
      }
    },
    [data]
  );

  return {
    data,
    updateOptimistic,
    isPending,
    isReverting,
    setData,
  };
}

/**
 * 🎯 OPTIMISTIC MUTATION HOOK
 *
 * Simplified hook for single mutations with automatic state management.
 * Perfect for simple create/update/delete operations.
 *
 * Example:
 * ```tsx
 * const createJob = useOptimisticMutation(
 *   (jobs, newJob) => [...jobs, newJob],
 *   (newJob) => api.createJob(newJob)
 * );
 *
 * await createJob(newJobData);
 * ```
 */
export function useOptimisticMutation<T, Args extends any[]>(
  optimisticUpdate: (current: T, ...args: Args) => T,
  mutationFn: (...args: Args) => Promise<any>,
  options?: OptimisticOptions<any>
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (...args: Args) => {
      setIsPending(true);
      setError(null);

      try {
        const result = await mutationFn(...args);
        setIsPending(false);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        setIsPending(false);
        const error = err as Error;
        setError(error);
        options?.onError?.(error);
        throw error;
      }
    },
    [mutationFn, options]
  );

  return {
    mutate,
    isPending,
    error,
  };
}

/**
 * 🔄 OPTIMISTIC LIST OPERATIONS
 *
 * Pre-built optimistic operations for common list manipulations.
 * Use with useOptimistic hook.
 */
export const optimisticOperations = {
  /**
   * Add item to list
   */
  add: <T>(list: T[], item: T): T[] => [...list, item],

  /**
   * Remove item from list
   */
  remove: <T>(list: T[], predicate: (item: T) => boolean): T[] =>
    list.filter((item) => !predicate(item)),

  /**
   * Update item in list
   */
  update: <T>(
    list: T[],
    predicate: (item: T) => boolean,
    updates: Partial<T>
  ): T[] =>
    list.map((item) => (predicate(item) ? { ...item, ...updates } : item)),

  /**
   * Replace entire item in list
   */
  replace: <T>(list: T[], predicate: (item: T) => boolean, newItem: T): T[] =>
    list.map((item) => (predicate(item) ? newItem : item)),

  /**
   * Move item in list
   */
  move: <T>(list: T[], fromIndex: number, toIndex: number): T[] => {
    const result = [...list];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    return result;
  },

  /**
   * Toggle boolean property
   */
  toggle: <T>(
    list: T[],
    predicate: (item: T) => boolean,
    key: keyof T
  ): T[] =>
    list.map((item) =>
      predicate(item) ? { ...item, [key]: !item[key] } : item
    ),
};
