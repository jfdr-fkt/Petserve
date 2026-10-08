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
      return {
        customerId: customer.id,
        customerName: customer.name,
        lastMessage: messages.at(-1) || null,
        unread: messages
          .slice(readCount)
          .filter((m) => (user.role === 'customer' ? m.role !== 'customer' : m.role === 'customer'))
          .length,
      };
    })
    .sort(
      (a, b) =>
        (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || '') ||
        a.customerName.localeCompare(b.customerName),
    );
}
module.exports = { chatThreads };
