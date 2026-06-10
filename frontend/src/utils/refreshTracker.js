let pendingVersion = 0;

export const getPendingVersion = () => pendingVersion;

export const incrementPendingVersion = () => {
  pendingVersion += 1;
};
