import Site from '../models/site.model.js';
import State from '../models/state.model.js';

/**
 * Syncs the 'status' of a State based on whether it has any active Sites.
 * A State becomes 'true' (active) if it has at least one Site with 'status: true'.
 * Otherwise, it becomes 'false' (inactive).
 * @param {string} state_id - The ID of the state to sync
 */
export const syncStateStatus = async (state_id) => {
    if (!state_id) return;

    try {
        // Count sites in this state that are active
        const activeSiteCount = await Site.countDocuments({
            state_id: state_id,
            status: true
        });

        const newStatus = activeSiteCount > 0;

        // Update the State status
        await State.findByIdAndUpdate(state_id, { status: newStatus });

        console.log(`[StateSync] State ${state_id} status updated to: ${newStatus} (Active Sites: ${activeSiteCount})`);
    } catch (err) {
        console.error(`[StateSync] Failed to sync status for state ${state_id}:`, err);
    }
};
