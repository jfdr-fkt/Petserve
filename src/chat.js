function chatThreads(db, user) {
  const customers = db.users.filter(
    (u) => u.role === 'customer' && !u.disabled && (user.role !== 'customer' || u.id === user.id),
  );
  return customers
    .map((customer) => {
      const thread = db.chats.find((t) => t.customerId === customer.id);
      const messages = thread?.messages || [];
      const readCount =
        thread?.[user.role === 'customer' ? 'customerReadCount' : 'staffReadCount'] || 0;
      const last = messages.at(-1);
      return {
        customerId: customer.id,
        customerName: customer.name,
        lastMessage: last
          ? {
              id: last.id,
              text: last.deletedAt
                ? 'Message deleted'
                : last.text ||
                  (last.attachment?.mime.startsWith('video/')
                    ? 'Video'
                    : last.attachment
                      ? 'Photo'
                      : ''),
              createdAt: last.createdAt,
            }
          : null,
        unread: messages
          .slice(readCount)
          .filter(
            (m) =>
              !m.deletedAt &&
              (user.role === 'customer' ? m.role !== 'customer' : m.role === 'customer'),
          ).length,
      };
    })
    .sort(
      (a, b) =>
        (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || '') ||
        a.customerName.localeCompare(b.customerName),
    );
}
function chatMessage(message, customerId, user) {
  const { senderId, attachment, ...visible } = message;
  return {
    ...visible,
    canDelete: !message.deletedAt && (senderId === user.id || user.role === 'admin'),
    attachment: attachment
      ? {
          mime: attachment.mime,
          size: attachment.size,
          url: `/api/chat/${customerId}/messages/${message.id}/content`,
        }
      : null,
  };
}
module.exports = { chatThreads, chatMessage };
