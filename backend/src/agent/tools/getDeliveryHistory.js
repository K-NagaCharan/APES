import { getRecentDeliveries } from "../../services/delivery.service.js";

/**
 * Executes the getDeliveryHistory tool.
 * Retrieves recent photo sharing/delivery history records for the authenticated user.
 */
export async function execute(args, userId) {
  const limit = args.limit || 10;
  const history = await getRecentDeliveries({ userId, limit });

  return history.map((r) => ({
    id: r._id.toString(),
    recipient: r.recipient,
    medium: r.medium,
    format: r.format || "links",
    count: r.count || r.photoIds?.length || 0,
    status: r.status,
    createdAt: r.createdAt,
    deliveredAt: r.deliveredAt || null,
    zipDeletedAt: r.zipDeletedAt || null,
    zipUrl: r.zipUrl || null
  }));
}
