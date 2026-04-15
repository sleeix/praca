const mysql = require('mysql');

const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE
});

function markCompletedBookings(db) {
  db.query(`
    UPDATE bookings
    SET status = 'completed'
    WHERE status = 'active'
      AND CONCAT(date, ' ', time) < NOW()
  `);
}

function autoDeleteOldBookings() {
  db.query(`
    DELETE FROM bookings
    WHERE status IN ('completed', 'cancelled')
      AND DATE_ADD(CONCAT(date, ' ', time), INTERVAL 1 DAY) < NOW()
  `, (err) => {
    if (err) console.log(err);
  });
}

exports.dashboard = (req, res) => {
  markCompletedBookings(db);
  autoDeleteOldBookings();

  const status = req.query.status || 'active';
  const date = req.query.date || null;

  db.query(
    `SELECT 
      COALESCE(SUM(status = 'active'), 0)    AS activeCount,
      COALESCE(SUM(status = 'completed'), 0) AS completedCount,
      COALESCE(SUM(status = 'cancelled'), 0) AS cancelledCount
    FROM bookings`,
    (err, countsResult) => {
      if (err) return res.redirect('/');

      const counts = countsResult[0];
      let where = [];
      let params = [];

      if (['active', 'completed', 'cancelled'].includes(status)) {
        where.push('bookings.status = ?');
        params.push(status);
      }

      if (date) {
        where.push('bookings.date = ?');
        params.push(date);
      }

      const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

      db.query(
        `SELECT bookings.*, fullname, users.email
        FROM bookings
        JOIN users ON bookings.user_id = users.id
        ${whereSQL}
        ORDER BY date ASC, time ASC`,
        params,
        (err, bookings) => {
          if (err) return res.redirect('/');

          db.query(
            `SELECT COUNT(*) AS openCount FROM tickets WHERE status = 'open'`,
            (err2, ticketCounts) => {
              const openTicketCount = (err2 || !ticketCounts.length) ? 0 : ticketCounts[0].openCount;

              res.render('admin', {
                user: req.session.user,
                bookings,
                currentStatus: status,
                selectedDate: date,
                counts,
                openTicketCount,
                activeTab: 'bookings'
              });
            }
          );
        }
      );
    }
  );
};

exports.cancelBookingAdmin = (req, res) => {
  const bookingId = req.params.id;

  db.query(
    `UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'active'`,
    [bookingId],
    (err) => {
      if (err) console.log(err);
      res.redirect('/admin');
    }
  );
};

exports.getMessages = (req, res) => {
  const statusFilter = req.query.status || 'open';

  db.query(
    `SELECT COUNT(*) AS openCount FROM tickets WHERE status = 'open'`,
    (err, openRes) => {
      const openCount = (err || !openRes.length) ? 0 : openRes[0].openCount;

      const validStatuses = ['open', 'answered', 'closed'];
      const whereSQL = validStatuses.includes(statusFilter) ? `WHERE t.status = ?` : '';

      db.query(
        `SELECT t.*,
           (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at ASC LIMIT 1) AS first_message,
           (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
           (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) AS message_count
         FROM tickets t
         ${whereSQL}
         ORDER BY t.updated_at DESC`,
        validStatuses.includes(statusFilter) ? [statusFilter] : [],
        (err2, tickets) => {
          if (err2) {
            console.log(err2);
            return res.redirect('/admin');
          }

          res.render('admin-messages', {
            user: req.session.user,
            tickets,
            currentStatus: statusFilter,
            openCount,
            activeTab: 'messages'
          });
        }
      );
    }
  );
};

exports.getTicket = (req, res) => {
  const ticketId = req.params.id;

  db.query(
    `SELECT COUNT(*) AS openCount FROM tickets WHERE status = 'open'`,
    (err, openRes) => {
      const openCount = (err || !openRes.length) ? 0 : openRes[0].openCount;

      db.query(
        'SELECT * FROM tickets WHERE id = ?',
        [ticketId],
        (err2, tickets) => {
          if (err2 || tickets.length === 0) return res.redirect('/admin/messages');

          const ticket = tickets[0];

          db.query(
            'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
            [ticketId],
            (err3, messages) => {
              if (err3) {
                console.log(err3);
                return res.redirect('/admin/messages');
              }

              const firstMsg = messages.length > 0 ? messages[0].message : '';
              const ticketTitle = firstMsg.length > 60 ? firstMsg.slice(0, 60) + '...' : firstMsg;

              res.render('admin-ticket', {
                user: req.session.user,
                ticket,
                messages,
                ticketTitle,
                openCount,
                activeTab: 'messages'
              });
            }
          );
        }
      );
    }
  );
};

exports.postTicketReply = (req, res) => {
  const ticketId = req.params.id;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.redirect(`/admin/messages/${ticketId}`);
  }

  db.query(
    'INSERT INTO ticket_messages (ticket_id, sender, message) VALUES (?, "admin", ?)',
    [ticketId, message.trim()],
    (err) => {
      if (err) {
        console.log(err);
        return res.redirect(`/admin/messages/${ticketId}`);
      }

      db.query(
        'UPDATE tickets SET status = "answered", updated_at = NOW() WHERE id = ?',
        [ticketId]
      );

      res.redirect(`/admin/messages/${ticketId}`);
    }
  );
};

exports.closeTicket = (req, res) => {
  const ticketId = req.params.id;

  db.query(
    'SELECT status FROM tickets WHERE id = ?',
    [ticketId],
    (err, result) => {
      if (err || !result.length) return res.redirect('/admin/messages');

      const newStatus = result[0].status === 'closed' ? 'open' : 'closed';

      db.query(
        'UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, ticketId],
        (err2) => {
          if (err2) console.log(err2);
          res.redirect(`/admin/messages/${ticketId}`);
        }
      );
    }
  );
};

exports.deleteTicket = (req, res) => {
  const ticketId = req.params.id;

  db.query(
    'DELETE FROM tickets WHERE id = ?',
    [ticketId],
    (err) => {
      if (err) console.log(err);
      res.redirect('/admin/messages');
    }
  );
};