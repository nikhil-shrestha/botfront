import { getConversationDurations } from '../queries/conversationDurations';
import { checkIfCan } from '../../../../lib/scopes';

export default {
    Query: {
        async conversationDurations(parent, args, context, info) {
            if (!args.projectId) throw new Error('ProjectId is required');
            if (context.user) checkIfCan('analytics:r', args.projectId, context.user._id);
            return getConversationDurations(args);
        },
    },
    ConversationDuration: {
        duration: (parent, args, context, info) => parent.duration,
        frequency: (parent, args, context, info) => parent.frequency,
        count: (parent, args, context, info) => parent.count,
    },
};
